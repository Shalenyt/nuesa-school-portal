import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { DigitalStudentID } from '@/components/Student/DigitalStudentID';

export default function StudentIDPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Digital Student ID</h1>
          <p className="text-muted-foreground">Your digital identification card with QR verification</p>
        </div>
        <DigitalStudentID />
      </div>
    </DashboardLayout>
  );
}
