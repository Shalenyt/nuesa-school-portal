import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Check admin role using service client
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profile?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin access required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { position_id, mode } = body;

    let positionsToClose: any[] = [];

    if (position_id) {
      const { data } = await supabase
        .from("electoral_positions")
        .select("*")
        .eq("id", position_id)
        .eq("voting_open", true)
        .single();
      if (data) positionsToClose = [data];
    } else {
      const { data } = await supabase
        .from("electoral_positions")
        .select("*")
        .eq("voting_open", true)
        .not("voting_end_time", "is", null)
        .lte("voting_end_time", new Date().toISOString());
      positionsToClose = data || [];
    }

    if (positionsToClose.length === 0) {
      return new Response(JSON.stringify({ message: "No elections to close" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const pos of positionsToClose) {
      await supabase
        .from("electoral_positions")
        .update({ voting_open: false, election_status: "closed" })
        .eq("id", pos.id);

      const { data: candidates } = await supabase
        .from("candidates")
        .select("id, student_id, profiles:student_id(full_name)")
        .eq("position_id", pos.id)
        .eq("approved", true);

      const candidateResults: any[] = [];
      let maxVotes = 0;

      for (const cand of candidates || []) {
        const { count } = await supabase
          .from("votes")
          .select("*", { count: "exact", head: true })
          .eq("position_id", pos.id)
          .eq("candidate_id", cand.id);

        const voteCount = count || 0;
        if (voteCount > maxVotes) maxVotes = voteCount;
        candidateResults.push({
          candidate_id: cand.id,
          student_id: cand.student_id,
          name: (cand as any).profiles?.full_name || "Unknown",
          vote_count: voteCount,
        });
      }

      await supabase.from("election_results").delete().eq("position_id", pos.id);

      for (const cr of candidateResults) {
        await supabase.from("election_results").insert({
          position_id: pos.id,
          candidate_id: cr.candidate_id,
          vote_count: cr.vote_count,
          is_winner: cr.vote_count === maxVotes && maxVotes > 0,
        });
      }

      const winner = candidateResults.find(
        (c) => c.vote_count === maxVotes && maxVotes > 0
      );
      const totalVotes = candidateResults.reduce((s, c) => s + c.vote_count, 0);

      results.push({
        position: pos.name,
        winner: winner?.name || "No votes",
        votes: winner?.vote_count || 0,
        total: totalVotes,
      });

      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("status", "approved");

      if (allProfiles && allProfiles.length > 0) {
        const notifications = allProfiles.map((p: any) => ({
          user_id: p.id,
          title: `🏆 Election Result: ${pos.name}`,
          message: winner
            ? `${winner.name} has won the position of ${pos.name} with ${winner.vote_count} vote(s) out of ${totalVotes} total votes.`
            : `The election for ${pos.name} has ended with no votes cast.`,
          type: "election_result",
          priority: "urgent",
          is_read: false,
        }));

        for (let i = 0; i < notifications.length; i += 500) {
          await supabase
            .from("notifications")
            .insert(notifications.slice(i, i + 500));
        }
      }
    }

    return new Response(JSON.stringify({ closed: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error closing election:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
