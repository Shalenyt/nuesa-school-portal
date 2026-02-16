import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreditCard, CheckCircle, Clock, AlertTriangle, Download, QrCode } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';
import { toast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';

export default function StudentPayments() {
  const { profile } = useAuth();
  const { settings } = useSchoolSettings();
  const [payments, setPayments] = useState<any[]>([]);
  const [myRecords, setMyRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);

  useEffect(() => {
    if (profile) fetchPayments();
  }, [profile]);

  const fetchPayments = async () => {
    try {
      const [paymentsRes, recordsRes] = await Promise.all([
        (supabase as any).from('payments').select('*, subjects:department_id(name), classes:level_id(name)').order('created_at', { ascending: false }),
        (supabase as any).from('payment_records').select('*').eq('student_id', profile?.id),
      ]);

      // Filter payments relevant to student
      const allPayments = (paymentsRes.data || []).filter((p: any) => {
        if (p.visibility === 'all') return true;
        if (p.department_id && (profile as any)?.department_id !== p.department_id) return false;
        if (p.level_id && (profile as any)?.level_id !== p.level_id) return false;
        return true;
      });

      setPayments(allPayments);
      setMyRecords(recordsRes.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const getPaymentStatus = (payment: any) => {
    const record = myRecords.find((r: any) => r.payment_id === payment.id);
    if (record) return { status: 'paid', record };
    if (payment.due_date && new Date(payment.due_date) < new Date()) return { status: 'overdue', record: null };
    return { status: 'pending', record: null };
  };

  const handleMarkAsPaid = async (payment: any) => {
    // Generate receipt
    const receiptNumber = `RCT-${Date.now().toString(36).toUpperCase()}`;
    const reference = `REF-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    
    try {
      const { error } = await (supabase as any).from('payment_records').insert({
        payment_id: payment.id,
        student_id: profile?.id,
        amount_paid: payment.amount,
        reference,
        receipt_number: receiptNumber,
        payment_method: 'manual',
        status: 'paid',
      });
      if (error) throw error;
      toast({ title: "Payment recorded", description: "Your payment has been recorded successfully." });
      fetchPayments();
    } catch (error: any) {
      if (error.message?.includes('duplicate')) {
        toast({ title: "Already paid", description: "You have already made this payment.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    }
  };

  const viewReceipt = (payment: any) => {
    const { record } = getPaymentStatus(payment);
    if (record) setSelectedReceipt({ ...record, paymentTitle: payment.title, paymentAmount: payment.amount });
  };

  const downloadReceipt = () => {
    if (!selectedReceipt) return;
    window.print();
  };

  const verifyUrl = selectedReceipt ? `${window.location.origin}/verify/payment/${selectedReceipt.id}` : '';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">View and manage your dues and payments</p>
        </div>

        {loading ? <div className="text-center py-8">Loading payments...</div> : (
          <>
            {/* Summary */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Total Due</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{payments.filter(p => getPaymentStatus(p).status !== 'paid').length}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Paid</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-green-600">{payments.filter(p => getPaymentStatus(p).status === 'paid').length}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Overdue</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-destructive">{payments.filter(p => getPaymentStatus(p).status === 'overdue').length}</p></CardContent>
              </Card>
            </div>

            {/* Payment List */}
            <div className="space-y-4">
              {payments.length === 0 ? (
                <Card><CardContent className="pt-6 text-center text-muted-foreground">No payments assigned to you.</CardContent></Card>
              ) : payments.map((payment: any) => {
                const { status, record } = getPaymentStatus(payment);
                return (
                  <Card key={payment.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            {payment.title}
                          </CardTitle>
                          {payment.description && <p className="text-sm text-muted-foreground mt-1">{payment.description}</p>}
                        </div>
                        <Badge variant={status === 'paid' ? 'default' : status === 'overdue' ? 'destructive' : 'secondary'}>
                          {status === 'paid' && <><CheckCircle className="h-3 w-3 mr-1" /> Paid</>}
                          {status === 'pending' && <><Clock className="h-3 w-3 mr-1" /> Pending</>}
                          {status === 'overdue' && <><AlertTriangle className="h-3 w-3 mr-1" /> Overdue</>}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold">₦{parseFloat(payment.amount).toLocaleString()}</p>
                          {payment.due_date && <p className="text-xs text-muted-foreground">Due: {new Date(payment.due_date).toLocaleDateString()}</p>}
                        </div>
                        <div className="flex gap-2">
                          {status === 'paid' ? (
                            <Button size="sm" variant="outline" onClick={() => viewReceipt(payment)}>
                              <Download className="h-4 w-4 mr-1" /> Receipt
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => handleMarkAsPaid(payment)}>
                              Pay Now
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {/* Receipt Dialog */}
        <Dialog open={!!selectedReceipt} onOpenChange={() => setSelectedReceipt(null)}>
          <DialogContent className="max-w-md print:max-w-full">
            <DialogHeader>
              <DialogTitle>Payment Receipt</DialogTitle>
            </DialogHeader>
            {selectedReceipt && (
              <div className="space-y-4 print:text-black" id="receipt">
                <div className="text-center border-b pb-4">
                  <h2 className="text-lg font-bold">{settings?.school_name || 'UNIABUJA'}</h2>
                  <p className="text-xs text-muted-foreground">NUESA - Faculty Dues Receipt</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Receipt No:</span></div>
                  <div className="font-medium">{selectedReceipt.receipt_number}</div>
                  <div><span className="text-muted-foreground">Student:</span></div>
                  <div className="font-medium">{profile?.full_name}</div>
                  <div><span className="text-muted-foreground">Matric No:</span></div>
                  <div className="font-medium">{profile?.student_id || 'N/A'}</div>
                  <div><span className="text-muted-foreground">Payment:</span></div>
                  <div className="font-medium">{selectedReceipt.paymentTitle}</div>
                  <div><span className="text-muted-foreground">Amount:</span></div>
                  <div className="font-bold text-lg">₦{parseFloat(selectedReceipt.amount_paid).toLocaleString()}</div>
                  <div><span className="text-muted-foreground">Date:</span></div>
                  <div className="font-medium">{new Date(selectedReceipt.paid_at).toLocaleDateString()}</div>
                  <div><span className="text-muted-foreground">Method:</span></div>
                  <div className="font-medium">{selectedReceipt.payment_method}</div>
                  <div><span className="text-muted-foreground">Reference:</span></div>
                  <div className="font-medium">{selectedReceipt.reference}</div>
                </div>
                <div className="flex justify-center pt-2">
                  <QRCodeSVG value={verifyUrl} size={100} level="M" includeMargin />
                </div>
                <p className="text-center text-[10px] text-muted-foreground">Scan to verify this receipt</p>
                <Button className="w-full print:hidden" onClick={downloadReceipt}>
                  <Download className="h-4 w-4 mr-2" /> Print Receipt
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
