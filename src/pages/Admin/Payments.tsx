import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Plus, Download, Upload, Trash2, Search, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export default function AdminPayments() {
  const { profile } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentRecords, setPaymentRecords] = useState<any[]>([]);
  const [paidCounts, setPaidCounts] = useState<Record<string, number>>({});
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [showSignatureUpload, setShowSignatureUpload] = useState(false);
  const [signatureType, setSignatureType] = useState<'president' | 'financial_secretary'>('president');
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [newPayment, setNewPayment] = useState({
    title: '', description: '', amount: '', payment_type: 'general',
    department_id: '', level_id: '', due_date: '', late_penalty: '0',
    visibility: 'all'
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [paymentsRes, classesRes, subjectsRes, recordsRes] = await Promise.all([
        (supabase as any).from('payments').select('*, subjects:department_id(name), classes:level_id(name)').order('created_at', { ascending: false }),
        supabase.from('classes').select('*').order('name'),
        supabase.from('subjects').select('*').order('name'),
        (supabase as any).from('payment_records').select('payment_id, amount_paid'),
      ]);
      setPayments(paymentsRes.data || []);
      setClasses(classesRes.data || []);
      setSubjects(subjectsRes.data || []);

      // Calculate paid counts and total revenue
      const records = recordsRes.data || [];
      const counts: Record<string, number> = {};
      let revenue = 0;
      records.forEach((r: any) => {
        counts[r.payment_id] = (counts[r.payment_id] || 0) + 1;
        revenue += parseFloat(r.amount_paid) || 0;
      });
      setPaidCounts(counts);
      setTotalRevenue(revenue);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchRecordsForPayment = async (paymentId: string) => {
    const { data } = await (supabase as any).from('payment_records')
      .select('*, profiles:student_id(full_name, student_id, email, department_id, level_id)')
      .eq('payment_id', paymentId)
      .order('paid_at', { ascending: false });
    setPaymentRecords(data || []);
  };

  const createPayment = async () => {
    if (!newPayment.title.trim() || !newPayment.amount) {
      toast({ title: "Error", description: "Title and amount are required.", variant: "destructive" });
      return;
    }
    try {
      const { error } = await (supabase as any).from('payments').insert({
        title: newPayment.title.trim(),
        description: newPayment.description.trim() || null,
        amount: parseFloat(newPayment.amount),
        payment_type: newPayment.payment_type,
        department_id: newPayment.department_id || null,
        level_id: newPayment.level_id || null,
        due_date: newPayment.due_date || null,
        late_penalty: parseFloat(newPayment.late_penalty) || 0,
        allow_partial: false,
        visibility: newPayment.visibility,
        created_by: profile?.id,
      });
      if (error) throw error;
      toast({ title: "Payment created" });
      setIsCreating(false);
      setNewPayment({ title: '', description: '', amount: '', payment_type: 'general', department_id: '', level_id: '', due_date: '', late_penalty: '0', visibility: 'all' });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const deletePayment = async () => {
    if (!deleteTarget) return;
    try {
      // Delete associated records first
      await (supabase as any).from('payment_records').delete().eq('payment_id', deleteTarget.id);
      const { error } = await (supabase as any).from('payments').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast({ title: "Payment deleted" });
      setDeleteTarget(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSignature(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `signatures/${signatureType}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('school-assets').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('school-assets').getPublicUrl(path);
      const column = signatureType === 'president' ? 'president_signature_url' : 'financial_secretary_signature_url';
      await (supabase as any).from('school_settings').update({ [column]: urlData.publicUrl }).eq('singleton', true);
      toast({ title: "Signature uploaded" });
      setShowSignatureUpload(false);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally { setUploadingSignature(false); }
  };

  const viewPaymentDetails = (payment: any) => {
    setSelectedPayment(payment);
    fetchRecordsForPayment(payment.id);
  };

  const filteredPayments = payments.filter(p => {
    if (filterType !== 'all' && p.payment_type !== filterType) return false;
    return true;
  });

  const filteredRecords = paymentRecords.filter(r => {
    const name = r.profiles?.full_name?.toLowerCase() || '';
    const matric = r.profiles?.student_id?.toLowerCase() || '';
    const q = searchQuery.toLowerCase();
    if (q && !name.includes(q) && !matric.includes(q)) return false;
    if (filterLevel !== 'all' && r.profiles?.level_id !== filterLevel) return false;
    if (filterDepartment !== 'all' && r.profiles?.department_id !== filterDepartment) return false;
    return true;
  });

  const exportCSV = () => {
    if (filteredRecords.length === 0) return;
    const headers = ['Student Name', 'Matric No', 'Amount', 'Date', 'Receipt No', 'Status'];
    const rows = filteredRecords.map((r: any) => [
      r.profiles?.full_name || '', r.profiles?.student_id || '',
      r.amount_paid, new Date(r.paid_at).toLocaleDateString(),
      r.receipt_number, r.status
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `payment-${selectedPayment?.title || 'export'}.csv`;
    a.click();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
            <p className="text-muted-foreground">Manage dues, fees, and payment tracking</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setShowSignatureUpload(true)}>
              <Upload className="h-4 w-4 mr-2" /> Signatures
            </Button>
            <Button size="sm" onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" /> New Payment
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Total Payments</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{payments.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Total Revenue</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">₦{totalRevenue.toLocaleString()}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Payment Types</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-1 flex-wrap">
                {['general', 'faculty', 'department'].map(t => (
                  <Badge key={t} variant="secondary" className="text-xs">
                    {t}: {payments.filter(p => p.payment_type === t).length}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <Tabs value={filterType} onValueChange={setFilterType}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="faculty">Faculty</TabsTrigger>
            <TabsTrigger value="department">Department</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Create Form */}
        {isCreating && (
          <Card>
            <CardHeader><CardTitle>Create New Payment</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder="Payment Title" value={newPayment.title} onChange={(e) => setNewPayment(p => ({ ...p, title: e.target.value }))} />
              <Textarea placeholder="Description" value={newPayment.description} onChange={(e) => setNewPayment(p => ({ ...p, description: e.target.value }))} rows={3} />
              <div className="grid gap-4 md:grid-cols-3">
                <Input placeholder="Amount (₦)" type="number" value={newPayment.amount} onChange={(e) => setNewPayment(p => ({ ...p, amount: e.target.value }))} />
                <Select value={newPayment.payment_type} onValueChange={(v) => setNewPayment(p => ({ ...p, payment_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="faculty">Faculty</SelectItem>
                    <SelectItem value="department">Department</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" value={newPayment.due_date} onChange={(e) => setNewPayment(p => ({ ...p, due_date: e.target.value }))} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Select value={newPayment.department_id || 'none'} onValueChange={(v) => setNewPayment(p => ({ ...p, department_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Department (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All Departments</SelectItem>
                    {subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={newPayment.level_id || 'none'} onValueChange={(v) => setNewPayment(p => ({ ...p, level_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Level (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All Levels</SelectItem>
                    {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Input placeholder="Late Penalty (₦)" type="number" className="max-w-[200px]" value={newPayment.late_penalty} onChange={(e) => setNewPayment(p => ({ ...p, late_penalty: e.target.value }))} />
              <div className="flex gap-2">
                <Button onClick={createPayment}>Create Payment</Button>
                <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment List */}
        {loading ? <div className="text-center py-8">Loading...</div> : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPayments.map((payment: any) => (
              <Card key={payment.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => viewPaymentDetails(payment)}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        {payment.title}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{payment.subjects?.name || 'All'} • {payment.classes?.name || 'All Levels'}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={payment.due_date && new Date(payment.due_date) < new Date() ? 'destructive' : 'default'}>
                        {payment.due_date && new Date(payment.due_date) < new Date() ? 'Overdue' : 'Active'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(payment); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">₦{parseFloat(payment.amount).toLocaleString()}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span>{paidCounts[payment.id] || 0} paid</span>
                    </div>
                    <Badge variant="secondary">{payment.payment_type}</Badge>
                  </div>
                  {payment.due_date && <p className="text-xs text-muted-foreground mt-1">Due: {new Date(payment.due_date).toLocaleDateString()}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Payment Detail Dialog */}
        <Dialog open={!!selectedPayment} onOpenChange={() => { setSelectedPayment(null); setSearchQuery(''); setFilterLevel('all'); setFilterDepartment('all'); }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedPayment?.title} - Payment Records</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Badge>₦{parseFloat(selectedPayment?.amount || 0).toLocaleString()}</Badge>
                <Badge variant="secondary">{selectedPayment?.payment_type}</Badge>
              </div>

              {/* Search and Filters */}
              <div className="grid gap-2 md:grid-cols-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search student..." className="pl-8" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <Select value={filterLevel} onValueChange={setFilterLevel}>
                  <SelectTrigger><SelectValue placeholder="Filter by level" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                  <SelectTrigger><SelectValue placeholder="Filter by dept" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-between items-center">
                <p className="text-sm font-medium">{filteredRecords.length} payment(s) received</p>
                <Button size="sm" variant="outline" onClick={exportCSV}>
                  <Download className="h-4 w-4 mr-1" /> Export CSV
                </Button>
              </div>
              {filteredRecords.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No payments recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {filteredRecords.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{r.profiles?.full_name}</p>
                        <p className="text-xs text-muted-foreground">{r.profiles?.student_id} • {r.receipt_number}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-sm">₦{parseFloat(r.amount_paid).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{new Date(r.paid_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Payment?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "{deleteTarget?.title}" and all associated payment records. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={deletePayment} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Signature Upload Dialog */}
        <Dialog open={showSignatureUpload} onOpenChange={setShowSignatureUpload}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Upload Signature</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Select value={signatureType} onValueChange={(v: any) => setSignatureType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="president">President Signature</SelectItem>
                  <SelectItem value="financial_secretary">Financial Secretary Signature</SelectItem>
                </SelectContent>
              </Select>
              <Input type="file" accept="image/*" onChange={handleSignatureUpload} disabled={uploadingSignature} />
              {uploadingSignature && <p className="text-sm text-muted-foreground">Uploading...</p>}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
