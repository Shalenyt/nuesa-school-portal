import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreditCard, CheckCircle, Clock, AlertTriangle, Download } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';
import { toast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';

function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if (num === 0) return 'Zero';
  if (num < 20) return ones[num];
  if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
  if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' and ' + numberToWords(num % 100) : '');
  if (num < 1000000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '');
  return numberToWords(Math.floor(num / 1000000)) + ' Million' + (num % 1000000 ? ' ' + numberToWords(num % 1000000) : '');
}

export default function StudentPayments() {
  const { profile } = useAuth();
  const { settings } = useSchoolSettings();
  const [payments, setPayments] = useState<any[]>([]);
  const [myRecords, setMyRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [signatures, setSignatures] = useState<{ president?: string; financial_secretary?: string }>({});
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile) {
      fetchPayments();
      fetchSignatures();
    }
  }, [profile]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref');
    if (reference && profile) {
      verifyPayment(reference);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [profile]);

  const fetchSignatures = async () => {
    const { data } = await (supabase as any).from('school_settings').select('president_signature_url, financial_secretary_signature_url').limit(1).maybeSingle();
    if (data) setSignatures({ president: data.president_signature_url, financial_secretary: data.financial_secretary_signature_url });
  };

  const fetchPayments = async () => {
    try {
      const [paymentsRes, recordsRes] = await Promise.all([
        (supabase as any).from('payments').select('*, subjects:department_id(name), classes:level_id(name)').order('created_at', { ascending: false }),
        (supabase as any).from('payment_records').select('*').eq('student_id', profile?.id),
      ]);

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

  const handlePayNow = async (payment: any) => {
    setPayingId(payment.id);
    try {
      const callbackUrl = `${window.location.origin}/student/payments`;
      const { data, error } = await supabase.functions.invoke('paystack-initialize', {
        body: { payment_id: payment.id, callback_url: callbackUrl },
      });
      if (error) throw new Error(error.message || 'Failed to initialize payment');
      if (data?.error) throw new Error(data.error);
      if (data?.authorization_url) window.location.href = data.authorization_url;
    } catch (error: any) {
      toast({ title: "Payment Error", description: error.message || 'Could not start payment', variant: "destructive" });
    } finally {
      setPayingId(null);
    }
  };

  const verifyPayment = async (reference: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('paystack-verify', { body: { reference } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({ title: "Payment Successful!", description: `Receipt: ${data.receipt_number}` });
      fetchPayments();
    } catch (error: any) {
      toast({ title: "Verification Issue", description: error.message, variant: "destructive" });
    }
  };

  const viewReceipt = (payment: any) => {
    const { record } = getPaymentStatus(payment);
    if (record) setSelectedReceipt({ ...record, paymentTitle: payment.title, paymentAmount: payment.amount, paymentDescription: payment.description });
  };

  const printReceipt = () => {
    if (!receiptRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>NUESA Receipt</title>
      <style>
        body { margin: 0; padding: 20px; font-family: 'Times New Roman', serif; }
        @media print { body { padding: 0; } }
      </style></head><body>${receiptRef.current.innerHTML}</body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const verifyUrl = selectedReceipt ? `${window.location.origin}/verify/payment/${selectedReceipt.id}` : '';

  const receiptDate = selectedReceipt ? new Date(selectedReceipt.paid_at) : new Date();
  const amountNum = selectedReceipt ? parseFloat(selectedReceipt.amount_paid) : 0;
  const naira = Math.floor(amountNum);
  const kobo = Math.round((amountNum - naira) * 100);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">View and manage your dues and payments</p>
        </div>

        {loading ? <div className="text-center py-8">Loading payments...</div> : (
          <>
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

            <div className="space-y-4">
              {payments.length === 0 ? (
                <Card><CardContent className="pt-6 text-center text-muted-foreground">No payments assigned to you.</CardContent></Card>
              ) : payments.map((payment: any) => {
                const { status } = getPaymentStatus(payment);
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
                            <Button size="sm" onClick={() => handlePayNow(payment)} disabled={payingId === payment.id}>
                              {payingId === payment.id ? 'Redirecting...' : 'Pay Now'}
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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Payment Receipt</DialogTitle>
            </DialogHeader>
            {selectedReceipt && (
              <div className="space-y-4">
                {/* Receipt Template */}
                <div ref={receiptRef} className="border-2 border-foreground p-6 bg-background" style={{ fontFamily: "'Times New Roman', serif" }}>
                  <div className="text-center mb-4">
                    <h2 className="text-xl font-bold tracking-wide">NUESA</h2>
                    <p className="text-xs">Nigerian Universities Engineering Students' Association</p>
                    <p className="text-lg font-bold mt-1">OFFICIAL RECEIPT</p>
                  </div>

                  <div className="flex justify-between text-sm mb-4">
                    <div>
                      <p>DAY: <span className="font-bold border-b border-foreground px-2">{receiptDate.getDate()}</span></p>
                      <p>MONTH: <span className="font-bold border-b border-foreground px-2">{receiptDate.toLocaleString('default', { month: 'long' })}</span></p>
                      <p>YEAR: <span className="font-bold border-b border-foreground px-2">{receiptDate.getFullYear()}</span></p>
                    </div>
                    <div className="text-right">
                      <p>NO: <span className="font-bold border-b border-foreground px-2">{selectedReceipt.receipt_number}</span></p>
                      <p>MATRIC NO: <span className="font-bold border-b border-foreground px-2">{profile?.student_id || 'N/A'}</span></p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <p>RECEIVED FROM: <span className="font-bold border-b border-foreground px-2">{profile?.full_name}</span></p>
                    <p>TOTAL SUM OF: <span className="font-bold border-b border-foreground px-2">{numberToWords(naira)} Naira{kobo > 0 ? ` and ${numberToWords(kobo)} Kobo` : ' Only'}</span></p>
                    
                    <div className="flex gap-4">
                      <p>NAIRA: <span className="font-bold border-b border-foreground px-4">{naira.toLocaleString()}</span></p>
                      <p>KOBO: <span className="font-bold border-b border-foreground px-4">{kobo.toString().padStart(2, '0')}</span></p>
                    </div>

                    <p>BEING PAYMENT FOR: <span className="font-bold border-b border-foreground px-2">{selectedReceipt.paymentDescription || selectedReceipt.paymentTitle}</span></p>

                    <div className="border-2 border-foreground inline-block px-4 py-2 mt-2">
                      <p className="text-lg font-bold">₦{amountNum.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex justify-between mt-8 pt-4">
                    <div className="text-center">
                      {signatures.president ? (
                        <img src={signatures.president} alt="President Signature" className="h-12 mx-auto mb-1" />
                      ) : (
                        <div className="h-12 w-32 border-b border-foreground mb-1" />
                      )}
                      <p className="text-xs font-bold">PRESIDENT</p>
                    </div>
                    <div className="text-center">
                      {signatures.financial_secretary ? (
                        <img src={signatures.financial_secretary} alt="Financial Secretary Signature" className="h-12 mx-auto mb-1" />
                      ) : (
                        <div className="h-12 w-32 border-b border-foreground mb-1" />
                      )}
                      <p className="text-xs font-bold">FINANCIAL SECRETARY</p>
                    </div>
                  </div>

                  <div className="flex justify-center mt-4">
                    <QRCodeSVG value={verifyUrl} size={80} level="M" />
                  </div>
                  <p className="text-center text-[8px] mt-1">Scan to verify</p>
                </div>

                <Button className="w-full" onClick={printReceipt}>
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
