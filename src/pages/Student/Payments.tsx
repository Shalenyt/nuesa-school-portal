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
import FacultyDuesReceipt from '@/components/Student/FacultyDuesReceipt';

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
    if (profile) { fetchPayments(); fetchSignatures(); }
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
    } finally { setPayingId(null); }
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
    if (record) setSelectedReceipt({ ...record, paymentTitle: payment.title, paymentAmount: payment.amount, paymentDescription: payment.description, paymentType: payment.payment_type });
  };

  const downloadReceipt = async () => {
    if (!receiptRef.current) return;
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF } = await import('jspdf');
      
      // Freeze dimensions before capture
      const el = receiptRef.current;
      const origWidth = el.offsetWidth;
      const origHeight = el.offsetHeight;
      
      const canvas = await html2canvas(el, {
        useCORS: true,
        scale: 2,
        allowTaint: true,
        width: origWidth,
        height: origHeight,
        windowWidth: origWidth,
        windowHeight: origHeight,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = origWidth * 0.75; // px to pt (96dpi → 72dpi)
      const pdfHeight = origHeight * 0.75;
      const pdf = new jsPDF({
        orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
        unit: 'pt',
        format: [pdfWidth, pdfHeight],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`NUESA_Receipt_${selectedReceipt?.receipt_number || 'receipt'}.pdf`);
    } catch {
      const printWindow = window.open('', '_blank');
      if (!printWindow || !receiptRef.current) return;
      printWindow.document.write(`<html><head><title>NUESA Receipt</title></head><body>${receiptRef.current.innerHTML}</body></html>`);
      printWindow.document.close();
      printWindow.print();
    }
  };

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
            {(() => {
              const outstanding = payments.filter(p => getPaymentStatus(p).status !== 'paid');
              const outstandingAmount = outstanding.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
              const paidAmount = myRecords.reduce((sum: number, r: any) => sum + parseFloat(r.amount_paid || 0), 0);
              const overdue = payments.filter(p => getPaymentStatus(p).status === 'overdue');
              const nextDue = outstanding
                .filter(p => p.due_date)
                .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];
              const lastRecord = [...myRecords].sort((a: any, b: any) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())[0];
              return (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Outstanding</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">₦{outstandingAmount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{outstanding.length} item{outstanding.length === 1 ? '' : 's'} unpaid</p>
                    </CardContent></Card>
                  <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Paid</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-green-600">₦{paidAmount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">
                        {lastRecord ? `Last on ${new Date(lastRecord.paid_at).toLocaleDateString()}` : 'No payments yet'}
                      </p>
                    </CardContent></Card>
                  <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Overdue</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-destructive">{overdue.length}</p>
                      <p className="text-xs text-muted-foreground">Past the due date</p>
                    </CardContent></Card>
                  <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Next deadline</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{nextDue ? new Date(nextDue.due_date).toLocaleDateString() : '—'}</p>
                      <p className="text-xs text-muted-foreground truncate">{nextDue ? nextDue.title : 'Nothing scheduled'}</p>
                    </CardContent></Card>
                </div>
              );
            })()}

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
                            <CreditCard className="h-4 w-4" />{payment.title}
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

            <Card>
              <CardHeader><CardTitle className="text-base">Payment history</CardTitle></CardHeader>
              <CardContent className="p-0 sm:p-0">
                {myRecords.length === 0 ? (
                  <p className="px-6 pb-6 text-sm text-muted-foreground">You have not made any payments yet.</p>
                ) : (
                  <ul className="divide-y">
                    {[...myRecords]
                      .sort((a: any, b: any) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())
                      .map((r: any) => {
                        const related = payments.find((p: any) => p.id === r.payment_id);
                        const ok = r.status === 'paid';
                        return (
                          <li key={r.id} className="px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{related?.title || 'Payment'}</p>
                              <p className="text-xs text-muted-foreground break-all">
                                Ref {r.reference} · Receipt {r.receipt_number} · {new Date(r.paid_at).toLocaleString()}
                              </p>
                            </div>
                            <Badge variant="outline" className={ok
                              ? 'bg-green-600/10 text-green-700 dark:text-green-400 border-green-600/30'
                              : r.status === 'failed'
                                ? 'bg-destructive/10 text-destructive border-destructive/30'
                                : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30'}>
                              {ok ? 'Successful' : r.status === 'failed' ? 'Failed' : 'Pending'}
                            </Badge>
                            <div className="ml-auto flex items-center gap-3">
                              <span className="font-semibold">₦{parseFloat(r.amount_paid).toLocaleString()}</span>
                              {related && ok && (
                                <Button size="sm" variant="outline" onClick={() => viewReceipt(related)}>
                                  <Download className="h-4 w-4 mr-1" /> Receipt
                                </Button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Receipt Dialog - portrait rectangular layout */}
        <Dialog open={!!selectedReceipt} onOpenChange={() => setSelectedReceipt(null)}>
          <DialogContent className="max-w-[920px] w-[96vw] max-h-[95vh] overflow-y-auto p-3 sm:p-4">
            <DialogHeader>
              <DialogTitle>Payment Receipt</DialogTitle>
            </DialogHeader>
            {selectedReceipt && (
              <div className="space-y-4">
                <div className="flex justify-center overflow-x-auto">
                  <div ref={receiptRef}>
                    {selectedReceipt.paymentType === 'faculty' ? (
                      <FacultyDuesReceipt
                        data={{
                          receiptNumber: selectedReceipt.receipt_number,
                          matricNumber: profile?.student_id || '',
                          fullName: profile?.full_name || '',
                          amountNaira: naira,
                          amountKobo: kobo,
                          amountInWords: numberToWords(naira) + ' Naira' + (kobo > 0 ? ` and ${numberToWords(kobo)} Kobo` : ' Only'),
                          paymentFor: selectedReceipt.paymentTitle || '',
                          paymentDate: receiptDate,
                          presidentSignatureUrl: signatures.president,
                          financialSecretarySignatureUrl: signatures.financial_secretary,
                        }}
                      />
                    ) : (
                      <div className="p-6 border rounded-lg text-center space-y-3">
                        <p className="font-bold text-lg">{selectedReceipt.paymentTitle}</p>
                        <p className="text-sm">Receipt No: {selectedReceipt.receipt_number}</p>
                        <p className="text-sm">Name: {profile?.full_name}</p>
                        <p className="text-sm">Matric: {profile?.student_id}</p>
                        <p className="text-2xl font-bold">₦{naira.toLocaleString()}.{kobo.toString().padStart(2, '0')}</p>
                        <p className="text-xs text-muted-foreground">Ref: {selectedReceipt.reference}</p>
                        <p className="text-xs text-muted-foreground">{receiptDate.toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button className="flex-1" onClick={downloadReceipt}>
                    <Download className="h-4 w-4 mr-2" /> Download Receipt
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => window.print()}>
                    Print Receipt
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
