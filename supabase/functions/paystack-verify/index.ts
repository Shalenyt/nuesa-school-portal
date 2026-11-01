import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = claimsData.claims.sub;
    const { reference } = await req.json();

    if (!reference) {
      return new Response(JSON.stringify({ error: 'reference is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!PAYSTACK_SECRET_KEY) {
      return new Response(JSON.stringify({ error: 'Payment gateway not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify transaction with Paystack
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });

    const verifyData = await verifyRes.json();
    if (!verifyRes.ok || !verifyData.status || verifyData.data?.status !== 'success') {
      return new Response(JSON.stringify({ error: 'Payment verification failed', status: verifyData.data?.status }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const txData = verifyData.data;
    const paymentId = txData.metadata?.payment_id;

    if (!paymentId) {
      return new Response(JSON.stringify({ error: 'Invalid payment metadata' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // The transaction must belong to the student calling this function
    // (paystack-initialize stores student_id in the metadata).
    if (txData.metadata?.student_id !== userId) {
      return new Response(JSON.stringify({ error: 'This payment does not belong to your account' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Service-role client for server-side reads and the insert below
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // The amount paid must cover the amount set for this payment
    const { data: expectedPayment } = await adminSupabase
      .from('payments')
      .select('amount')
      .eq('id', paymentId)
      .maybeSingle();

    if (!expectedPayment || txData.amount < Math.round(Number(expectedPayment.amount) * 100)) {
      return new Response(JSON.stringify({ error: 'Payment amount does not match' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Prevent duplicate records
    const { data: existing } = await supabase
      .from('payment_records')
      .select('id')
      .eq('reference', reference)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ success: true, message: 'Payment already recorded' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const receiptNumber = `RCT-${Date.now().toString(36).toUpperCase()}`;

    // Insert payment record using service role for reliability
    const { error: insertError } = await adminSupabase
      .from('payment_records')
      .insert({
        payment_id: paymentId,
        student_id: userId,
        amount_paid: txData.amount / 100, // Convert from kobo
        reference,
        receipt_number: receiptNumber,
        payment_method: 'paystack',
        status: 'paid',
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to record payment' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      success: true,
      receipt_number: receiptNumber,
      amount: txData.amount / 100,
      reference,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
