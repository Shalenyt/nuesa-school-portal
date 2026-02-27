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
  const [receiptTemplates, setReceiptTemplates] = useState<any[]>([]);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile) { fetchPayments(); fetchSignatures(); fetchTemplates(); }
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

  const fetchTemplates = async () => {
    const { data } = await (supabase as any).from('receipt_templates').select('*');
    setReceiptTemplates(data || []);
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
      const canvas = await html2canvas(receiptRef.current, { useCORS: true, scale: 2, allowTaint: true });
      const link = document.createElement('a');
      link.download = `NUESA_Receipt_${selectedReceipt?.receipt_number || 'receipt'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      const printWindow = window.open('', '_blank');
      if (!printWindow || !receiptRef.current) return;
      printWindow.document.write(`<html><head><title>NUESA Receipt</title></head><body>${receiptRef.current.innerHTML}</body></html>`);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const verifyUrl = selectedReceipt ? `${window.location.origin}/verify/payment/${selectedReceipt.id}` : '';
  const receiptDate = selectedReceipt ? new Date(selectedReceipt.paid_at) : new Date();
  const amountNum = selectedReceipt ? parseFloat(selectedReceipt.amount_paid) : 0;
  const naira = Math.floor(amountNum);
  const kobo = Math.round((amountNum - naira) * 100);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // Find the matching receipt template
  const getTemplate = () => {
    if (!selectedReceipt) return null;
    const paymentType = selectedReceipt.paymentType || 'general';
    return receiptTemplates.find(t => t.payment_type === paymentType) || receiptTemplates.find(t => t.payment_type === 'general');
  };

  const template = selectedReceipt ? getTemplate() : null;

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
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Due</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{payments.filter(p => getPaymentStatus(p).status !== 'paid').length}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Paid</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-green-600">{payments.filter(p => getPaymentStatus(p).status === 'paid').length}</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Overdue</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-destructive">{payments.filter(p => getPaymentStatus(p).status === 'overdue').length}</p></CardContent></Card>
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
          </>
        )}

        {/* Receipt Dialog */}
        <Dialog open={!!selectedReceipt} onOpenChange={() => setSelectedReceipt(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Payment Receipt</DialogTitle>
            </DialogHeader>
            {selectedReceipt && (
              <div className="space-y-4">
                <div ref={receiptRef} style={{ position: 'relative', fontFamily: "'Times New Roman', Georgia, serif" }}>
                  {template ? (
                    /* === TEMPLATE MODE: Overlay text on uploaded image === */
                    <div style={{ position: 'relative', width: '100%' }}>
                      <img
                        src={template.template_url}
                        alt="Receipt Template"
                        style={{ width: '100%', display: 'block' }}
                        crossOrigin="anonymous"
                      />
                      {/* Text overlays with absolute positioning */}
                      {/* Receipt Number - top right area */}
                      <div style={{ position: 'absolute', top: '12%', right: '5%', fontSize: '12px', fontWeight: 'bold', color: '#1a1a1a' }}>
                        {selectedReceipt.receipt_number}
                      </div>
                      {/* Date - upper area */}
                      <div style={{ position: 'absolute', top: '18%', left: '10%', fontSize: '11px', fontWeight: 'bold', color: '#1a1a1a' }}>
                        {receiptDate.getDate().toString().padStart(2, '0')} / {months[receiptDate.getMonth()]} / {receiptDate.getFullYear()}
                      </div>
                      {/* Matric Number */}
                      <div style={{ position: 'absolute', top: '18%', right: '5%', fontSize: '11px', fontWeight: 'bold', color: '#1a1a1a' }}>
                        {profile?.student_id || 'N/A'}
                      </div>
                      {/* Received From */}
                      <div style={{ position: 'absolute', top: '30%', left: '30%', fontSize: '12px', fontWeight: 'bold', color: '#1a1a1a', maxWidth: '60%', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {profile?.full_name}
                      </div>
                      {/* Total sum in words */}
                      <div style={{ position: 'absolute', top: '38%', left: '25%', fontSize: '11px', fontWeight: 'bold', color: '#1a1a1a', maxWidth: '70%', overflow: 'hidden' }}>
                        {numberToWords(naira)} Naira{kobo > 0 ? ` and ${numberToWords(kobo)} Kobo` : ' Only'}
                      </div>
                      {/* Amount in figures */}
                      <div style={{ position: 'absolute', top: '46%', right: '8%', fontSize: '13px', fontWeight: 'bold', color: '#1a1a1a' }}>
                        ₦{naira.toLocaleString()}.{kobo.toString().padStart(2, '0')}
                      </div>
                      {/* Being payment for */}
                      <div style={{ position: 'absolute', top: '54%', left: '30%', fontSize: '11px', fontWeight: 'bold', color: '#1a1a1a', maxWidth: '60%', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {selectedReceipt.paymentDescription || selectedReceipt.paymentTitle}
                      </div>
                      {/* Payment reference */}
                      <div style={{ position: 'absolute', top: '62%', left: '30%', fontSize: '10px', color: '#555' }}>
                        Ref: {selectedReceipt.reference}
                      </div>
                      {/* Signatures */}
                      {signatures.president && (
                        <img src={signatures.president} alt="President" crossOrigin="anonymous" style={{ position: 'absolute', bottom: '15%', left: '8%', height: '35px', opacity: 0.9 }} />
                      )}
                      {signatures.financial_secretary && (
                        <img src={signatures.financial_secretary} alt="Fin. Sec." crossOrigin="anonymous" style={{ position: 'absolute', bottom: '15%', right: '8%', height: '35px', opacity: 0.9 }} />
                      )}
                    </div>
                  ) : (
                    /* === FALLBACK: CSS-based receipt if no template uploaded === */
                    <div style={{ background: '#f5f3ef', border: '3px double #1a5c2e', padding: '24px' }}>
                      {/* Header */}
                      <div style={{ textAlign: 'center', marginBottom: '16px', color: '#1a5c2e' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <img src={settings?.logo_url || oaustechLogo} alt="Logo" style={{ height: '50px', width: '50px', objectFit: 'contain' }} />
                          <div style={{ flex: 1, padding: '0 12px' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, letterSpacing: '1px' }}>NIGERIA UNIVERSITIES ENGINEERING</h2>
                            <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, letterSpacing: '1px' }}>STUDENT' ASSOCIATION (NUESA)</h2>
                            <p style={{ fontSize: '13px', fontWeight: 'bold', margin: '4px 0 0' }}>UNIVERSITY OF ABUJA CHAPTER</p>
                          </div>
                          <img src={settings?.logo_url || oaustechLogo} alt="Logo" style={{ height: '50px', width: '50px', objectFit: 'contain' }} />
                        </div>
                        <div style={{ display: 'inline-block', background: '#1a5c2e', color: 'white', padding: '4px 20px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold', marginTop: '8px' }}>
                          {(selectedReceipt.paymentType || 'GENERAL').toUpperCase()} DUES RECEIPT
                        </div>
                      </div>

                      {/* Date + Receipt No row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', color: '#1a5c2e', fontSize: '13px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <span style={{ border: '1px solid #1a5c2e', padding: '2px 8px', fontWeight: 'bold', fontSize: '11px' }}>DAY</span>
                          <span style={{ border: '1px solid #1a5c2e', padding: '2px 12px', fontWeight: 'bold' }}>{receiptDate.getDate().toString().padStart(2, '0')}</span>
                          <span style={{ border: '1px solid #1a5c2e', padding: '2px 8px', fontWeight: 'bold', fontSize: '11px' }}>MONTH</span>
                          <span style={{ border: '1px solid #1a5c2e', padding: '2px 12px', fontWeight: 'bold' }}>{months[receiptDate.getMonth()]}</span>
                          <span style={{ border: '1px solid #1a5c2e', padding: '2px 8px', fontWeight: 'bold', fontSize: '11px' }}>YEAR</span>
                          <span style={{ border: '1px solid #1a5c2e', padding: '2px 12px', fontWeight: 'bold' }}>{receiptDate.getFullYear()}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ margin: 0 }}><strong>NO:</strong> {selectedReceipt.receipt_number}</p>
                          <p style={{ margin: '2px 0 0' }}><strong>Matric No:</strong> <span style={{ border: '1px solid #1a5c2e', padding: '1px 8px' }}>{profile?.student_id || 'N/A'}</span></p>
                        </div>
                      </div>

                      {/* Body fields */}
                      <div style={{ color: '#1a5c2e', fontSize: '13px', lineHeight: '2.2' }}>
                        <p style={{ margin: 0 }}><em style={{ fontWeight: 'bold' }}>Received from:</em> <span style={{ borderBottom: '1px solid #1a5c2e', paddingBottom: '1px', marginLeft: '8px' }}>{profile?.full_name}</span></p>
                        <p style={{ margin: 0 }}><em style={{ fontWeight: 'bold' }}>Total sum of:</em> <span style={{ borderBottom: '1px solid #1a5c2e', paddingBottom: '1px', marginLeft: '8px' }}>{numberToWords(naira)} Naira{kobo > 0 ? ` and ${numberToWords(kobo)} Kobo` : ' Only'}</span></p>
                        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                          <span style={{ borderBottom: '1px solid #1a5c2e', flex: 1 }}></span>
                          <em style={{ fontWeight: 'bold' }}>Naira</em>
                          <span style={{ borderBottom: '1px solid #1a5c2e', minWidth: '80px', textAlign: 'center' }}>{naira.toLocaleString()}</span>
                          <em style={{ fontWeight: 'bold' }}>kobo</em>
                          <span style={{ borderBottom: '1px solid #1a5c2e', minWidth: '40px', textAlign: 'center' }}>{kobo.toString().padStart(2, '0')}</span>
                        </div>
                        <p style={{ margin: 0 }}><em style={{ fontWeight: 'bold' }}>Being payment for:</em> <span style={{ borderBottom: '1px solid #1a5c2e', marginLeft: '8px' }}>{selectedReceipt.paymentDescription || selectedReceipt.paymentTitle}</span></p>
                      </div>

                      {/* Signatures + Amount */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '20px', color: '#1a5c2e' }}>
                        <div style={{ textAlign: 'center' }}>
                          {signatures.president ? (
                            <img src={signatures.president} alt="President" style={{ height: '40px', marginBottom: '4px' }} />
                          ) : (
                            <div style={{ height: '40px', width: '120px', borderBottom: '1px solid #1a5c2e', marginBottom: '4px' }} />
                          )}
                          <p style={{ fontSize: '11px', fontWeight: 'bold', fontStyle: 'italic', margin: 0 }}>President's Signature</p>
                        </div>
                        <div style={{ border: '2px solid #1a5c2e', padding: '6px 16px', fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>₦</span><span>{amountNum.toLocaleString()}</span><span style={{ margin: '0 4px' }}>:</span><span>K</span><span>{kobo.toString().padStart(2, '0')}</span>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          {signatures.financial_secretary ? (
                            <img src={signatures.financial_secretary} alt="Fin. Secretary" style={{ height: '40px', marginBottom: '4px' }} />
                          ) : (
                            <div style={{ height: '40px', width: '120px', borderBottom: '1px solid #1a5c2e', marginBottom: '4px' }} />
                          )}
                          <p style={{ fontSize: '11px', fontWeight: 'bold', fontStyle: 'italic', margin: 0 }}>Financial Secretary's Signature</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* QR Code */}
                <div className="flex justify-center">
                  <div className="text-center">
                    <QRCodeSVG value={verifyUrl} size={64} level="M" />
                    <p className="text-[10px] text-muted-foreground mt-1">Scan to verify</p>
                  </div>
                </div>

                <Button className="w-full" onClick={downloadReceipt}>
                  <Download className="h-4 w-4 mr-2" /> Download Receipt
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
