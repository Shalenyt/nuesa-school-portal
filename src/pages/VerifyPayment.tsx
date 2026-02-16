import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, XCircle } from 'lucide-react';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';
import oaustechLogo from '@/assets/oaustech-logo.png';

export default function VerifyPayment() {
  const { id } = useParams();
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { settings } = useSchoolSettings();

  useEffect(() => {
    if (!id) { setError('No payment ID provided'); setLoading(false); return; }
    fetchRecord(id);
  }, [id]);

  const fetchRecord = async (recordId: string) => {
    try {
      const { data, error: fetchError } = await (supabase as any)
        .from('payment_records')
        .select('*, profiles:student_id(full_name, student_id, email), payments:payment_id(title, amount)')
        .eq('id', recordId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!data) { setError('Payment record not found'); return; }
      setRecord(data);
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse">Verifying payment...</div></div>;

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <XCircle className="h-16 w-16 text-destructive mx-auto" />
          <h2 className="text-xl font-bold">Verification Failed</h2>
          <p className="text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full overflow-hidden">
        <div className="bg-primary p-4 text-center">
          <img src={settings?.logo_url || oaustechLogo} alt="Logo" className="h-8 w-8 mx-auto mb-1" />
          <p className="text-primary-foreground font-bold">{settings?.school_name || 'UNIABUJA'}</p>
          <p className="text-primary-foreground/80 text-xs">Payment Verification</p>
        </div>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-center gap-2 text-green-600">
            <CheckCircle className="h-6 w-6" />
            <span className="font-bold text-lg">Valid Payment</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground">Student</div>
            <div className="font-medium">{record.profiles?.full_name}</div>
            <div className="text-muted-foreground">Matric No</div>
            <div className="font-medium">{record.profiles?.student_id || 'N/A'}</div>
            <div className="text-muted-foreground">Payment</div>
            <div className="font-medium">{record.payments?.title}</div>
            <div className="text-muted-foreground">Amount</div>
            <div className="font-bold">₦{parseFloat(record.amount_paid).toLocaleString()}</div>
            <div className="text-muted-foreground">Receipt No</div>
            <div className="font-medium">{record.receipt_number}</div>
            <div className="text-muted-foreground">Date</div>
            <div className="font-medium">{new Date(record.paid_at).toLocaleDateString()}</div>
            <div className="text-muted-foreground">Status</div>
            <div className="font-medium text-green-600">{record.status}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
