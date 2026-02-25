import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreditCard, Plus, Download, Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export default function AdminPayments() {
  const { profile } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentRecords, setPaymentRecords] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [showSignatureUpload, setShowSignatureUpload] = useState(false);
  const [signatureType, setSignatureType] = useState<'president' | 'financial_secretary'>('president');
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [newPayment, setNewPayment] = useState({
    title: '', description: '', amount: '', payment_type: 'general',
    department_id: '', level_id: '', due_date: '', late_penalty: '0',
    allow_partial: false, visibility: 'all'
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [paymentsRes, classesRes, subjectsRes] = await Promise.all([
        (supabase as any).from('payments').select('*, subjects:department_id(name), classes:level_id(name)').order('created_at', { ascending: false }),
        supabase.from('classes').select('*').order('name'),
        supabase.from('subjects').select('*').order('name'),
      ]);
      setPayments(paymentsRes.data || []);
      setClasses(classesRes.data || []);
      setSubjects(subjectsRes.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchRecordsForPayment = async (paymentId: string) => {
    const { data } = await (supabase as any).from('payment_records')
      .select('*, profiles:student_id(full_name, student_id, email)')
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
        allow_partial: newPayment.allow_partial,
        visibility: newPayment.visibility,
        created_by: profile?.id,
      });
      if (error) throw error;
      toast({ title: "Payment created" });
      setIsCreating(false);
      setNewPayment({ title: '', description: '', amount: '', payment_type: 'general', department_id: '', level_id: '', due_date: '', late_penalty: '0', allow_partial: false, visibility: 'all' });
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
      toast({ title: "Signature uploaded", description: `${signatureType === 'president' ? 'President' : 'Financial Secretary'} signature updated.` });
      setShowSignatureUpload(false);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingSignature(false);
    }
  };

  const viewPaymentDetails = (payment: any) => {
    setSelectedPayment(payment);
    fetchRecordsForPayment(payment.id);
  };

  const totalExpected = payments.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);

  const exportCSV = () => {
    if (paymentRecords.length === 0) return;
    const headers = ['Student Name', 'Matric No', 'Amount', 'Date', 'Receipt No', 'Status'];
    const rows = paymentRecords.map((r: any) => [
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowSignatureUpload(true)}>
              <Upload className="h-4 w-4 mr-2" /> Upload Signature
            </Button>
            <Button onClick={() => setIsCreating(true)}>
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
            <CardHeader className="pb-2"><CardTitle className="text-sm">Total Expected Revenue</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">₦{totalExpected.toLocaleString()}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Active Payments</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{payments.filter((p: any) => !p.due_date || new Date(p.due_date) >= new Date()).length}</p></CardContent>
          </Card>
        </div>

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
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={newPayment.allow_partial} onCheckedChange={(v) => setNewPayment(p => ({ ...p, allow_partial: v }))} />
                  <Label>Allow Partial Payment</Label>
                </div>
                <Input placeholder="Late Penalty (₦)" type="number" className="max-w-[200px]" value={newPayment.late_penalty} onChange={(e) => setNewPayment(p => ({ ...p, late_penalty: e.target.value }))} />
              </div>
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
            {payments.map((payment: any) => (
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
                    <Badge variant={payment.due_date && new Date(payment.due_date) < new Date() ? 'destructive' : 'default'}>
                      {payment.due_date && new Date(payment.due_date) < new Date() ? 'Overdue' : 'Active'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">₦{parseFloat(payment.amount).toLocaleString()}</p>
                  {payment.due_date && <p className="text-xs text-muted-foreground mt-1">Due: {new Date(payment.due_date).toLocaleDateString()}</p>}
                  <Badge variant="secondary" className="mt-2">{payment.payment_type}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Payment Detail Dialog */}
        <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedPayment?.title} - Payment Records</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Badge>₦{parseFloat(selectedPayment?.amount || 0).toLocaleString()}</Badge>
                <Badge variant="secondary">{selectedPayment?.payment_type}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium">{paymentRecords.length} payment(s) received</p>
                <Button size="sm" variant="outline" onClick={exportCSV}>
                  <Download className="h-4 w-4 mr-1" /> Export CSV
                </Button>
              </div>
              {paymentRecords.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No payments recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {paymentRecords.map((r: any) => (
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
