import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowUpDown, Download, Search } from 'lucide-react';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';

interface Row {
  id: string;
  student_name: string;
  matric: string;
  payment_title: string;
  payment_type: string;
  amount: number;
  status: string;
  department: string;
  level: string;
  reference: string;
  receipt_number: string;
  paid_at: string;
  verified: boolean;
}

const PAGE_SIZE = 15;

export function PaymentExports() {
  const { settings } = useSchoolSettings();
  const faculty = (settings as any)?.faculty_name || 'Engineering';

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [dept, setDept] = useState('all');
  const [level, setLevel] = useState('all');
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(0); }, [search, type, dept, level, status, from, to]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from('payment_records')
        .select('id, amount_paid, reference, receipt_number, status, paid_at, verified_by, payments:payment_id(title, payment_type), profiles:student_id(full_name, student_id, subjects:department_id(name), classes:level_id(name))')
        .order('paid_at', { ascending: false })
        .limit(1000);

      setRows((data || []).map((r: any) => ({
        id: r.id,
        student_name: r.profiles?.full_name || '—',
        matric: r.profiles?.student_id || '—',
        payment_title: r.payments?.title || '—',
        payment_type: r.payments?.payment_type || 'general',
        amount: Number(r.amount_paid) || 0,
        status: r.status || 'unknown',
        department: r.profiles?.subjects?.name || '—',
        level: r.profiles?.classes?.name || '—',
        reference: r.reference || '—',
        receipt_number: r.receipt_number || '—',
        paid_at: r.paid_at,
        verified: !!r.verified_by || r.status === 'success',
      })));
    } catch (e) {
      console.error('Failed to load payment records');
    } finally {
      setLoading(false);
    }
  };

  const departments = useMemo(() => Array.from(new Set(rows.map(r => r.department))).filter(d => d !== '—').sort(), [rows]);
  const levels = useMemo(() => Array.from(new Set(rows.map(r => r.level))).filter(l => l !== '—').sort(), [rows]);
  const types = useMemo(() => Array.from(new Set(rows.map(r => r.payment_type))).sort(), [rows]);
  const statuses = useMemo(() => Array.from(new Set(rows.map(r => r.status))).sort(), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter(r => {
      if (q && ![r.student_name, r.matric, r.reference, r.receipt_number, r.payment_title].some(v => v.toLowerCase().includes(q))) return false;
      if (type !== 'all' && r.payment_type !== type) return false;
      if (dept !== 'all' && r.department !== dept) return false;
      if (level !== 'all' && r.level !== level) return false;
      if (status !== 'all' && r.status !== status) return false;
      if (from && new Date(r.paid_at) < new Date(from)) return false;
      if (to && new Date(r.paid_at) > new Date(`${to}T23:59:59`)) return false;
      return true;
    });
    return list.sort((a, b) => sortAsc
      ? new Date(a.paid_at).getTime() - new Date(b.paid_at).getTime()
      : new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());
  }, [rows, search, type, dept, level, status, from, to, sortAsc]);

  const totalAmount = filtered.reduce((sum, r) => sum + r.amount, 0);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const exportCsv = () => {
    const headers = ['Student Name', 'Matric NO', 'Payment Type', 'Payment Title', 'Amount (NGN)', 'Payment Status', 'Department', 'Faculty', 'Level', 'Payment Reference', 'Receipt No', 'Date Paid', 'Verification Status'];
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = filtered.map(r => [
      r.student_name, r.matric, r.payment_type, r.payment_title, r.amount, r.status,
      r.department, faculty, r.level, r.reference, r.receipt_number,
      new Date(r.paid_at).toLocaleString(), r.verified ? 'Verified' : 'Unverified',
    ].map(esc).join(','));
    const csv = [headers.map(esc).join(','), ...lines].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nuesa-payment-records-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle>Payment Records &amp; Exports</CardTitle>
          <p className="text-sm text-muted-foreground">
            {filtered.length} record{filtered.length === 1 ? '' : 's'} · ₦{totalAmount.toLocaleString()}
          </p>
        </div>
        <Button size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="h-4 w-4 mr-2" aria-hidden="true" /> Export CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input className="pl-8" placeholder="Name, Matric NO, reference…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search payment records" />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger aria-label="Payment type"><SelectValue placeholder="Payment type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payment types</SelectItem>
              {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger aria-label="Department"><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger aria-label="Level"><SelectValue placeholder="Level" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              {levels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Payment status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Paid from date" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Paid to date" />
          <Button variant="outline" onClick={() => setSortAsc(v => !v)}>
            <ArrowUpDown className="h-4 w-4 mr-2" aria-hidden="true" />
            Date {sortAsc ? 'oldest first' : 'newest first'}
          </Button>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student Name</TableHead>
                <TableHead>Matric NO</TableHead>
                <TableHead>Payment Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Faculty</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Date Paid</TableHead>
                <TableHead>Verification</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Loading payment records…</TableCell></TableRow>
              )}
              {!loading && pageRows.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No payment records match these filters.</TableCell></TableRow>
              )}
              {pageRows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium whitespace-nowrap">{r.student_name}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.matric}</TableCell>
                  <TableCell className="capitalize">{r.payment_type}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">₦{r.amount.toLocaleString()}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{r.status}</Badge></TableCell>
                  <TableCell>{r.department}</TableCell>
                  <TableCell>{faculty}</TableCell>
                  <TableCell>{r.level}</TableCell>
                  <TableCell className="font-mono text-xs">{r.reference}</TableCell>
                  <TableCell className="whitespace-nowrap">{new Date(r.paid_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <span className={r.verified ? 'text-primary font-medium' : 'text-muted-foreground'}>
                      {r.verified ? 'Verified' : 'Unverified'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">Page {page + 1} of {pageCount}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
