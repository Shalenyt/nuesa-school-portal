import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DateInput } from '@/components/ui/date-input';
import { ExternalLink, Eye, EyeOff, ImagePlus, Loader2, Pencil, Plus, RefreshCw, Star, Trash2 } from 'lucide-react';
import { CATEGORIES } from '@/pages/Blog/content';
import { Markdown, timeAgo } from '@/pages/Blog/shared';

const db = supabase as any;
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const BODIES = ['NUESA UniAbuja', 'Faculty', 'NUESA National', 'NSE', 'NSE Abuja', 'COREN'];

async function uploadImage(file: File, folder: string) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file');
  if (file.size > 5 * 1024 * 1024) throw new Error('Image must be under 5 MB');
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('blog').upload(path, file, { cacheControl: '31536000', upsert: false });
  if (error) throw error;
  return supabase.storage.from('blog').getPublicUrl(path).data.publicUrl;
}

function ImageField({ value, onChange, folder }: { value: string; onChange: (v: string) => void; folder: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      {value && <img src={value} alt="" className="h-32 w-full rounded-xl object-cover" />}
      <div className="flex gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} {value ? 'Change image' : 'Upload image'}
          <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            setBusy(true);
            try { onChange(await uploadImage(f, folder)); } catch (err: any) { toast({ title: 'Upload failed', description: err.message, variant: 'destructive' }); }
            setBusy(false); e.target.value = '';
          }} />
        </label>
        {value && <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>Remove</Button>}
      </div>
    </div>
  );
}

/* ---------------- Articles ---------------- */

const emptyPost = { id: '', title: '', slug: '', excerpt: '', content: '', category: 'nuesa', cover_url: '', author_name: 'NUESA Editorial', published: false, featured: false };

function ArticlesTab() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any | null>(null);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<any | null>(null);

  const load = async () => {
    const { data } = await db.from('blog_posts').select('*').order('created_at', { ascending: false });
    setPosts(data || []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!edit.title.trim() || !edit.content.trim()) { toast({ title: 'Add a title and the article text', variant: 'destructive' }); return; }
    setSaving(true);
    const row = {
      title: edit.title.trim(), slug: slugify(edit.slug || edit.title), excerpt: edit.excerpt.trim() || null, content: edit.content,
      category: edit.category, cover_url: edit.cover_url || null, author_name: edit.author_name.trim() || 'NUESA Editorial',
      published: edit.published, featured: edit.featured,
    };
    const res = edit.id
      ? await db.from('blog_posts').update(row).eq('id', edit.id)
      : await db.from('blog_posts').insert({ ...row, author_id: profile?.id });
    setSaving(false);
    if (res.error) { toast({ title: "Couldn't save", description: res.error.message.includes('duplicate') ? 'Another article already uses this web address (slug). Change the slug.' : res.error.message, variant: 'destructive' }); return; }
    // Only one featured article at a time
    if (row.featured) await db.from('blog_posts').update({ featured: false }).neq('slug', row.slug).eq('featured', true);
    toast({ title: row.published ? 'Article published' : 'Draft saved' });
    setEdit(null); load();
  };

  const remove = async () => {
    await db.from('blog_posts').delete().eq('id', del.id);
    setDel(null); toast({ title: 'Article deleted' }); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => { setPreview(false); setEdit({ ...emptyPost }); }}><Plus className="mr-1 h-4 w-4" /> New article</Button></div>
      {loading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : posts.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No articles yet. Write the first one.</CardContent></Card>
      ) : posts.map((p) => (
        <Card key={p.id}>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            {p.cover_url ? <img src={p.cover_url} alt="" className="h-16 w-24 shrink-0 rounded-lg object-cover" /> : <div className="h-16 w-24 shrink-0 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-500" />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={p.published ? 'default' : 'secondary'}>{p.published ? 'Published' : 'Draft'}</Badge>
                {p.featured && <Badge variant="outline" className="gap-1"><Star className="h-3 w-3" /> Featured</Badge>}
                <span className="text-xs text-muted-foreground">{CATEGORIES[p.category]?.label} · {p.views} views · {timeAgo(p.updated_at)}</span>
              </div>
              <p className="mt-1 font-semibold">{p.title}</p>
            </div>
            <div className="flex gap-2">
              {p.published && <Button variant="outline" size="sm" asChild><a href={`/articles/${p.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>}
              <Button variant="outline" size="sm" onClick={() => { setPreview(false); setEdit({ ...emptyPost, ...p, excerpt: p.excerpt || '', cover_url: p.cover_url || '' }); }}><Pencil className="mr-1 h-4 w-4" /> Edit</Button>
              <Button variant="destructive" size="sm" onClick={() => setDel(p)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-2xl">
          <DialogHeader><DialogTitle>{edit?.id ? 'Edit article' : 'New article'}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-4">
              <div className="space-y-1"><Label>Title</Label><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value, slug: edit.id ? edit.slug : slugify(e.target.value) })} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label>Web address</Label><Input value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: slugify(e.target.value) })} placeholder="auto from title" /><p className="text-xs text-muted-foreground">nuesa.org/articles/{edit.slug || '…'}</p></div>
                <div className="space-y-1"><Label>Category</Label>
                  <Select value={edit.category} onValueChange={(v) => setEdit({ ...edit, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1"><Label>Short summary</Label><Textarea rows={2} value={edit.excerpt} onChange={(e) => setEdit({ ...edit, excerpt: e.target.value })} placeholder="One or two sentences shown on cards" /></div>
              <div className="space-y-1"><Label>Cover image</Label><ImageField value={edit.cover_url} onChange={(v) => setEdit({ ...edit, cover_url: v })} folder="covers" /></div>
              <div className="space-y-1">
                <div className="flex items-center justify-between"><Label>Article</Label>
                  <div className="flex rounded-md border p-0.5 text-xs">
                    <button type="button" className={`rounded px-2 py-1 ${!preview ? 'bg-muted font-semibold' : ''}`} onClick={() => setPreview(false)}>Write</button>
                    <button type="button" className={`rounded px-2 py-1 ${preview ? 'bg-muted font-semibold' : ''}`} onClick={() => setPreview(true)}>Preview</button>
                  </div>
                </div>
                {preview ? (
                  <div className="min-h-[260px] rounded-md border p-4"><Markdown text={edit.content || '_Nothing to preview yet_'} /></div>
                ) : (
                  <Textarea rows={14} value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })} className="font-mono text-sm"
                    placeholder={'Write here. Formatting:\n## Heading\n**bold**  *italic*\n- bullet point\n1. numbered point\n> quote\n[link text](https://example.com)'} />
                )}
              </div>
              <div className="space-y-1"><Label>Author shown</Label><Input value={edit.author_name} onChange={(e) => setEdit({ ...edit, author_name: e.target.value })} /></div>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm"><Switch checked={edit.published} onCheckedChange={(v) => setEdit({ ...edit, published: v })} /> Published</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={edit.featured} onCheckedChange={(v) => setEdit({ ...edit, featured: v })} /> Feature on the home page</label>
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{edit?.published ? 'Publish' : 'Save draft'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete "{del?.title}"?</AlertDialogTitle><AlertDialogDescription>This removes the article from the blog permanently.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------------- News ---------------- */

function NewsTab() {
  const [news, setNews] = useState<any[]>([]);
  const [state, setState] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('visible');

  const load = async () => {
    const [{ data: n }, { data: s }] = await Promise.all([
      db.from('blog_news').select('*').order('published_at', { ascending: false }).limit(200),
      db.from('blog_state').select('*').eq('id', true).maybeSingle(),
    ]);
    setNews(n || []); setState(s);
  };
  useEffect(() => { load(); }, []);

  const refresh = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('fetch-news', { body: {} });
    setBusy(false);
    if (error) { toast({ title: 'Refresh failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: data?.skipped ? 'Checked recently' : `${data?.added ?? 0} new headlines`, description: data?.errors?.length ? `Some sources didn't answer: ${data.errors.join(', ')}` : undefined });
    load();
  };
  const update = async (id: string, patch: any) => {
    setNews((x) => x.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    const { error } = await db.from('blog_news').update(patch).eq('id', id);
    if (error) toast({ title: "Couldn't update", description: error.message, variant: 'destructive' });
  };
  const shown = news.filter((n) => (filter === 'hidden' ? n.hidden : filter === 'visible' ? !n.hidden : true));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p><span className="font-semibold">Last checked:</span> {state?.last_fetch_at ? timeAgo(state.last_fetch_at) : 'never'}{state?.last_fetch_added != null && ` · ${state.last_fetch_added} new`}</p>
            <p className="text-muted-foreground">Headlines are collected automatically every 2 hours. Hide anything that isn't relevant.</p>
            {state?.last_fetch_error && <p className="mt-1 text-xs text-amber-600">Some sources didn't answer last time: {state.last_fetch_error}</p>}
          </div>
          <Button onClick={refresh} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Refresh now</Button>
        </CardContent>
      </Card>
      <div className="flex gap-2">
        {[['visible', 'Showing'], ['hidden', 'Hidden'], ['all', 'All']].map(([k, l]) => (
          <Button key={k} size="sm" variant={filter === k ? 'default' : 'outline'} onClick={() => setFilter(k)}>{l}</Button>
        ))}
      </div>
      <div className="divide-y rounded-xl border">
        {shown.map((n) => (
          <div key={n.id} className={`flex flex-col gap-2 p-3 sm:flex-row sm:items-center ${n.hidden ? 'opacity-60' : ''}`}>
            <div className="min-w-0 flex-1">
              <a href={n.link} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-primary">{n.title}</a>
              <p className="text-xs text-muted-foreground">{n.source} · {timeAgo(n.published_at)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={n.category} onValueChange={(v) => update(n.id, { category: v })}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{['nse', 'coren', 'nuesa', 'uniabuja', 'engineering', 'students'].map((c) => <SelectItem key={c} value={c}>{CATEGORIES[c].label}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => update(n.id, { hidden: !n.hidden })}>
                {n.hidden ? <><Eye className="mr-1 h-4 w-4" /> Show</> : <><EyeOff className="mr-1 h-4 w-4" /> Hide</>}
              </Button>
            </div>
          </div>
        ))}
        {shown.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nothing here.</p>}
      </div>
    </div>
  );
}

/* ---------------- Leaders ---------------- */

const emptyLeader = { id: '', body: 'NUESA UniAbuja', name: '', role: '', term: '', bio: '', photo_url: '', source_url: '', sort: 100, active: true };

function LeadersTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [edit, setEdit] = useState<any | null>(null);
  const load = async () => { const { data } = await db.from('blog_leaders').select('*').order('body').order('sort'); setRows(data || []); };
  useEffect(() => { load(); }, []);
  const groups = useMemo(() => {
    const g: Record<string, any[]> = {};
    rows.forEach((r) => (g[r.body] ||= []).push(r));
    return g;
  }, [rows]);

  const save = async () => {
    if (!edit.name.trim() || !edit.role.trim() || !edit.body.trim()) { toast({ title: 'Add a group, name and role', variant: 'destructive' }); return; }
    const row = { body: edit.body.trim(), name: edit.name.trim(), role: edit.role.trim(), term: edit.term || null, bio: edit.bio || null,
      photo_url: edit.photo_url || null, source_url: edit.source_url || null, sort: Number(edit.sort) || 100, active: edit.active };
    const res = edit.id ? await db.from('blog_leaders').update(row).eq('id', edit.id) : await db.from('blog_leaders').insert(row);
    if (res.error) { toast({ title: "Couldn't save", description: res.error.message, variant: 'destructive' }); return; }
    toast({ title: 'Saved' }); setEdit(null); load();
  };
  const remove = async (id: string) => { await db.from('blog_leaders').delete().eq('id', id); load(); };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setEdit({ ...emptyLeader })}><Plus className="mr-1 h-4 w-4" /> Add person</Button></div>
      {Object.entries(groups).map(([body, list]) => (
        <Card key={body}>
          <CardHeader className="pb-2"><CardTitle className="text-base">{body}</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {list.map((l) => (
              <div key={l.id} className={`flex items-center gap-3 py-2 ${l.active ? '' : 'opacity-50'}`}>
                {l.photo_url ? <img src={l.photo_url} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <div className="h-10 w-10 rounded-lg bg-muted" />}
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{l.name}</p><p className="truncate text-xs text-muted-foreground">{l.role}</p></div>
                <Button size="sm" variant="outline" onClick={() => setEdit({ ...emptyLeader, ...l, term: l.term || '', bio: l.bio || '', photo_url: l.photo_url || '', source_url: l.source_url || '' })}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(l.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto rounded-2xl">
          <DialogHeader><DialogTitle>{edit?.id ? 'Edit person' : 'Add person'}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="space-y-1"><Label>Group</Label>
                <Select value={BODIES.includes(edit.body) ? edit.body : 'custom'} onValueChange={(v) => setEdit({ ...edit, body: v === 'custom' ? '' : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BODIES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}<SelectItem value="custom">Other…</SelectItem></SelectContent>
                </Select>
                {!BODIES.includes(edit.body) && <Input placeholder="Group name" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />}
              </div>
              <div className="space-y-1"><Label>Name</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. Engr. Jane Doe" /></div>
              <div className="space-y-1"><Label>Role</Label><Input value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })} placeholder="e.g. President" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Term</Label><Input value={edit.term} onChange={(e) => setEdit({ ...edit, term: e.target.value })} placeholder="2026/2027" /></div>
                <div className="space-y-1"><Label>Order</Label><Input type="number" value={edit.sort} onChange={(e) => setEdit({ ...edit, sort: e.target.value })} /></div>
              </div>
              <div className="space-y-1"><Label>Short bio</Label><Textarea rows={3} value={edit.bio} onChange={(e) => setEdit({ ...edit, bio: e.target.value })} /></div>
              <div className="space-y-1"><Label>Photo</Label><ImageField value={edit.photo_url} onChange={(v) => setEdit({ ...edit, photo_url: v })} folder="leaders" /></div>
              <div className="space-y-1"><Label>Source link (optional)</Label><Input value={edit.source_url} onChange={(e) => setEdit({ ...edit, source_url: e.target.value })} placeholder="https://" /></div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={edit.active} onCheckedChange={(v) => setEdit({ ...edit, active: v })} /> Show on the blog</label>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Events ---------------- */

const emptyEvent = { id: '', title: '', date: '', time: '10:00', location: '', description: '', link: '', published: true };

function EventsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [edit, setEdit] = useState<any | null>(null);
  const load = async () => { const { data } = await db.from('blog_events').select('*').order('starts_at', { ascending: false }); setRows(data || []); };
  useEffect(() => { load(); }, []);
  const save = async () => {
    if (!edit.title.trim() || !edit.date) { toast({ title: 'Add a title and date', variant: 'destructive' }); return; }
    const starts_at = new Date(`${edit.date}T${edit.time || '10:00'}:00+01:00`).toISOString();
    const row = { title: edit.title.trim(), starts_at, location: edit.location || null, description: edit.description || null, link: edit.link || null, published: edit.published };
    const res = edit.id ? await db.from('blog_events').update(row).eq('id', edit.id) : await db.from('blog_events').insert(row);
    if (res.error) { toast({ title: "Couldn't save", description: res.error.message, variant: 'destructive' }); return; }
    toast({ title: 'Event saved' }); setEdit(null); load();
  };
  const toLocal = (iso: string) => {
    const d = new Date(new Date(iso).getTime() + 60 * 60 * 1000); // Lagos time
    return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) };
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setEdit({ ...emptyEvent })}><Plus className="mr-1 h-4 w-4" /> Add event</Button></div>
      {rows.length === 0 && <Card><CardContent className="py-10 text-center text-muted-foreground">No events yet.</CardContent></Card>}
      {rows.map((e) => (
        <Card key={e.id}><CardContent className="flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{e.title} {!e.published && <Badge variant="secondary" className="ml-1">Hidden</Badge>}</p>
            <p className="text-xs text-muted-foreground">{new Date(e.starts_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}{e.location ? ` · ${e.location}` : ''}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setEdit({ ...emptyEvent, ...e, ...toLocal(e.starts_at), location: e.location || '', description: e.description || '', link: e.link || '' })}><Pencil className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={async () => { await db.from('blog_events').delete().eq('id', e.id); load(); }}><Trash2 className="h-4 w-4" /></Button>
        </CardContent></Card>
      ))}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader><DialogTitle>{edit?.id ? 'Edit event' : 'Add event'}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="space-y-1"><Label>Title</Label><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <div className="space-y-1"><Label>Date</Label><DateInput value={edit.date} onChange={(v) => setEdit({ ...edit, date: v })} /></div>
                <div className="space-y-1"><Label>Time</Label><Input type="time" value={edit.time} onChange={(e) => setEdit({ ...edit, time: e.target.value })} className="w-32" /></div>
              </div>
              <div className="space-y-1"><Label>Location</Label><Input value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} placeholder="e.g. Faculty of Engineering auditorium" /></div>
              <div className="space-y-1"><Label>Description</Label><Textarea rows={3} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
              <div className="space-y-1"><Label>Link (optional)</Label><Input value={edit.link} onChange={(e) => setEdit({ ...edit, link: e.target.value })} placeholder="https://" /></div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={edit.published} onCheckedChange={(v) => setEdit({ ...edit, published: v })} /> Show on the blog</label>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Sources ---------------- */

function SourcesTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [add, setAdd] = useState({ name: '', kind: 'search', query: '', category: 'engineering', keyword_filter: true });
  const load = async () => { const { data } = await db.from('blog_feeds').select('*').order('kind').order('name'); setRows(data || []); };
  useEffect(() => { load(); }, []);
  const toggle = async (f: any) => { await db.from('blog_feeds').update({ enabled: !f.enabled }).eq('id', f.id); load(); };
  const create = async () => {
    if (!add.name.trim() || !add.query.trim()) { toast({ title: 'Add a name and a search or feed address', variant: 'destructive' }); return; }
    if (add.kind === 'rss' && !/^https?:\/\//.test(add.query)) { toast({ title: 'A feed address must start with https://', variant: 'destructive' }); return; }
    const { error } = await db.from('blog_feeds').insert({ ...add, name: add.name.trim(), query: add.query.trim(), keyword_filter: add.kind === 'rss' && add.keyword_filter });
    if (error) { toast({ title: "Couldn't add", description: error.message, variant: 'destructive' }); return; }
    setAdd({ name: '', kind: 'search', query: '', category: 'engineering', keyword_filter: true }); load();
  };
  return (
    <div className="space-y-4">
      <Card><CardContent className="space-y-3 p-4">
        <p className="text-sm text-muted-foreground">A <strong>search</strong> looks up news with words you choose. A <strong>site feed</strong> reads a website's RSS feed; for general news sites, keep only engineering stories on.</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_2fr_auto_auto]">
          <Input placeholder="Name" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} />
          <Select value={add.kind} onValueChange={(v) => setAdd({ ...add, kind: v })}><SelectTrigger className="sm:w-32"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="search">Search</SelectItem><SelectItem value="rss">Site feed</SelectItem></SelectContent></Select>
          <Input placeholder={add.kind === 'rss' ? 'https://site.com/feed/' : 'e.g. "Nigerian Society of Engineers" Abuja'} value={add.query} onChange={(e) => setAdd({ ...add, query: e.target.value })} />
          <Select value={add.category} onValueChange={(v) => setAdd({ ...add, category: v })}><SelectTrigger className="sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{['nse', 'coren', 'nuesa', 'uniabuja', 'engineering', 'students'].map((c) => <SelectItem key={c} value={c}>{CATEGORIES[c].label}</SelectItem>)}</SelectContent></Select>
          <Button onClick={create}><Plus className="h-4 w-4" /></Button>
        </div>
        {add.kind === 'rss' && <label className="flex items-center gap-2 text-sm"><Switch checked={add.keyword_filter} onCheckedChange={(v) => setAdd({ ...add, keyword_filter: v })} /> Keep only engineering stories</label>}
      </CardContent></Card>
      <div className="divide-y rounded-xl border">
        {rows.map((f) => (
          <div key={f.id} className="flex items-center gap-3 p-3">
            <Switch checked={f.enabled} onCheckedChange={() => toggle(f)} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{f.name} <Badge variant="outline" className="ml-1 text-[10px]">{f.kind === 'rss' ? 'Site feed' : 'Search'}</Badge> <Badge variant="secondary" className="text-[10px]">{CATEGORIES[f.category]?.label}</Badge></p>
              <p className="truncate text-xs text-muted-foreground">{f.query}{f.keyword_filter ? ' · engineering stories only' : ''}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={async () => { await db.from('blog_feeds').delete().eq('id', f.id); load(); }}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminBlog() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Blog</h1>
            <p className="text-muted-foreground">Manage the public front page of nuesa.org: articles, news, leaders and events.</p>
          </div>
          <Button variant="outline" asChild><a href="/" target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> View blog</a></Button>
        </div>
        <Tabs defaultValue="articles">
          <TabsList className="flex h-auto w-full flex-wrap justify-start">
            <TabsTrigger value="articles">Articles</TabsTrigger>
            <TabsTrigger value="news">News</TabsTrigger>
            <TabsTrigger value="leaders">Leaders</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="sources">Sources</TabsTrigger>
          </TabsList>
          <TabsContent value="articles" className="mt-4"><ArticlesTab /></TabsContent>
          <TabsContent value="news" className="mt-4"><NewsTab /></TabsContent>
          <TabsContent value="leaders" className="mt-4"><LeadersTab /></TabsContent>
          <TabsContent value="events" className="mt-4"><EventsTab /></TabsContent>
          <TabsContent value="sources" className="mt-4"><SourcesTab /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
