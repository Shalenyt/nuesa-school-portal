import { forwardRef } from 'react';
import nuesaLogo from '@/assets/nuesa-logo.png';
import uniabujaLogo from '@/assets/uniabuja-logo.png';

interface ReceiptData {
  receiptNumber: string;
  matricNumber: string;
  fullName: string;
  amountNaira: number;
  amountKobo: number;
  amountInWords: string;
  paymentFor: string;
  paymentDate: Date;
  presidentSignatureUrl?: string;
  financialSecretarySignatureUrl?: string;
}

const FacultyDuesReceipt = forwardRef<HTMLDivElement, { data: ReceiptData }>(
  ({ data }, ref) => {
    const day = data.paymentDate.getDate().toString().padStart(2, '0');
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const month = months[data.paymentDate.getMonth()];
    const year = data.paymentDate.getFullYear().toString();

    return (
      <div ref={ref} style={{
        width: '740px',
        height: '408px',
        backgroundColor: '#f9fdfa',
        border: '1px solid #d1d5db',
        position: 'relative',
        padding: '20px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        boxSizing: 'border-box',
        fontFamily: "'Times New Roman', Georgia, serif",
      }}>
        {/* Inner border */}
        <div style={{
          position: 'absolute', top: '8px', left: '8px', right: '8px', bottom: '8px',
          border: '1px solid #2d7a4d', pointerEvents: 'none', borderRadius: '2px',
        }} />

        {/* Watermark */}
        <img src={nuesaLogo} alt="" crossOrigin="anonymous" style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          opacity: 0.08, width: '200px', zIndex: 0, pointerEvents: 'none',
        }} />

        {/* Header */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <img src={nuesaLogo} alt="NUESA" crossOrigin="anonymous" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
          <div style={{ textAlign: 'center', flex: 1, padding: '0 8px' }}>
            <h1 style={{ fontFamily: "'Times New Roman', Georgia, serif", fontSize: '13px', fontWeight: 'bold', color: '#1e633d', letterSpacing: '0.05em', margin: 0 }}>
              NIGERIA UNIVERSITIES ENGINEERING
            </h1>
            <h1 style={{ fontFamily: "'Times New Roman', Georgia, serif", fontSize: '13px', fontWeight: 'bold', color: '#1e633d', letterSpacing: '0.05em', margin: 0 }}>
              STUDENT' ASSOCIATION (NUESA)
            </h1>
            <h2 style={{ fontFamily: "'Times New Roman', Georgia, serif", fontSize: '12px', fontWeight: 'bold', color: '#1e633d', marginTop: '4px', margin: '4px 0 0' }}>
              UNIVERSITY OF ABUJA CHAPTER
            </h2>
            <div style={{
              display: 'inline-block', background: '#1e633d', color: 'white',
              padding: '2px 12px', borderRadius: '20px', fontSize: '10px',
              fontWeight: 'bold', letterSpacing: '0.05em', marginTop: '6px',
            }}>
              FACULTY DUES RECEIPT
            </div>
          </div>
          <img src={uniabujaLogo} alt="UniAbuja" crossOrigin="anonymous" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
        </div>

        {/* Date + ID */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '14px' }}>
          <table style={{ borderCollapse: 'collapse', textAlign: 'center', fontSize: '9px' }}>
            <thead>
              <tr style={{ background: '#1e633d', color: 'white', fontWeight: 'bold' }}>
                <td style={{ border: '1px solid #2d7a4d', padding: '2px 6px' }}>DAY</td>
                <td style={{ border: '1px solid #2d7a4d', padding: '2px 6px' }}>MONTH</td>
                <td style={{ border: '1px solid #2d7a4d', padding: '2px 6px' }}>YEAR</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #2d7a4d', height: '20px', width: '28px', fontWeight: 'bold', color: '#000', fontSize: '10px' }}>{day}</td>
                <td style={{ border: '1px solid #2d7a4d', height: '20px', width: '50px', fontWeight: 'bold', color: '#000', fontSize: '10px' }}>{month}</td>
                <td style={{ border: '1px solid #2d7a4d', height: '20px', width: '40px', fontWeight: 'bold', color: '#000', fontSize: '10px' }}>{year}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '4px' }}>
              <span style={{ color: '#1e633d', fontWeight: 'bold', fontSize: '11px', marginRight: '4px' }}>NO:</span>
              <div style={{ width: '100px', borderBottom: '2px solid #1e633d', textAlign: 'center', fontWeight: 'bold', color: '#000', fontSize: '10px' }}>
                {data.receiptNumber}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <span style={{ color: '#1e633d', fontWeight: 'bold', fontSize: '11px', marginRight: '4px' }}>Matric No:</span>
              <div style={{ width: '100px', border: '1px solid #1e633d', height: '20px', lineHeight: '20px', textAlign: 'center', fontWeight: 'bold', color: '#000', fontSize: '10px' }}>
                {data.matricNumber}
              </div>
            </div>
          </div>
        </div>

        {/* Form fields */}
        <div style={{ position: 'relative', zIndex: 10 }}>
          {/* Received from */}
          <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '10px' }}>
            <span style={{ color: '#1e633d', fontStyle: 'italic', fontWeight: 'bold', fontSize: '11px', whiteSpace: 'nowrap' }}>Received from:</span>
            <div style={{ borderBottom: '2px solid #1e633d', flexGrow: 1, marginLeft: '6px', textAlign: 'left', paddingLeft: '4px' }}>
              <span style={{ fontWeight: 'bold', color: '#000', fontSize: '11px' }}>{data.fullName}</span>
            </div>
          </div>

          {/* Total sum of */}
          <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '10px' }}>
            <span style={{ color: '#1e633d', fontStyle: 'italic', fontWeight: 'bold', fontSize: '11px', whiteSpace: 'nowrap' }}>Total sum of:</span>
            <div style={{ borderBottom: '2px solid #1e633d', flexGrow: 1, marginLeft: '6px', textAlign: 'left', paddingLeft: '4px' }}>
              <span style={{ fontWeight: 'bold', color: '#000', fontSize: '11px' }}>{data.amountInWords}</span>
            </div>
          </div>

          {/* Naira / Kobo row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '10px' }}>
            <div style={{ borderBottom: '2px solid #1e633d', flexGrow: 1 }} />
            <span style={{ color: '#1e633d', fontStyle: 'italic', fontWeight: 'bold', fontSize: '11px', margin: '0 8px' }}>Naira</span>
            <div style={{ width: '80px', borderBottom: '2px solid #1e633d', textAlign: 'center' }}>
              <span style={{ fontWeight: 'bold', color: '#000', fontSize: '11px' }}>{data.amountNaira.toLocaleString()}</span>
            </div>
            <span style={{ color: '#1e633d', fontStyle: 'italic', fontWeight: 'bold', fontSize: '11px', margin: '0 12px' }}>kobo</span>
            <div style={{ width: '50px', borderBottom: '2px solid #1e633d', textAlign: 'center' }}>
              <span style={{ fontWeight: 'bold', color: '#000', fontSize: '11px' }}>{data.amountKobo.toString().padStart(2, '0')}</span>
            </div>
          </div>

          {/* Being payment for */}
          <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '16px' }}>
            <span style={{ color: '#1e633d', fontStyle: 'italic', fontWeight: 'bold', fontSize: '11px', whiteSpace: 'nowrap' }}>Being payment for:</span>
            <div style={{ borderBottom: '2px solid #1e633d', flexGrow: 1, marginLeft: '6px', textAlign: 'left', paddingLeft: '4px' }}>
              <span style={{ fontWeight: 'bold', color: '#000', fontSize: '11px' }}>{data.paymentFor}</span>
            </div>
          </div>

          {/* Extra dotted line */}
          <div style={{ borderBottom: '2px solid #1e633d', marginBottom: '14px' }} />
        </div>

        {/* Footer */}
        <div style={{
          position: 'absolute', bottom: '16px', left: '20px', right: '20px', zIndex: 10,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        }}>
          <div style={{ width: '30%' }}>
            {data.presidentSignatureUrl ? (
              <img src={data.presidentSignatureUrl} alt="President" crossOrigin="anonymous" style={{ height: '24px', marginBottom: '2px' }} />
            ) : (
              <div style={{ height: '24px', marginBottom: '2px' }} />
            )}
            <div style={{ borderBottom: '2px solid #1e633d', marginBottom: '2px' }} />
            <p style={{ color: '#1e633d', fontStyle: 'italic', fontWeight: 'bold', fontSize: '9px', margin: 0 }}>President's Signature</p>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center',
            border: '2px solid #1e633d', borderRadius: '2px',
            padding: '2px 8px', background: 'white',
          }}>
            <span style={{ color: '#1e633d', fontWeight: 'bold', fontSize: '14px', marginRight: '4px' }}>₦</span>
            <div style={{ width: '80px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontWeight: 'bold', color: '#000', fontSize: '13px' }}>{data.amountNaira.toLocaleString()}</span>
            </div>
            <span style={{ color: '#1e633d', fontWeight: 'bold', fontSize: '14px', margin: '0 4px' }}>:</span>
            <span style={{ color: '#1e633d', fontWeight: 'bold', fontSize: '14px' }}>K</span>
            <span style={{ fontWeight: 'bold', color: '#000', fontSize: '13px', marginLeft: '2px' }}>{data.amountKobo.toString().padStart(2, '0')}</span>
          </div>

          <div style={{ width: '30%', textAlign: 'right' }}>
            {data.financialSecretarySignatureUrl ? (
              <img src={data.financialSecretarySignatureUrl} alt="Fin. Secretary" crossOrigin="anonymous" style={{ height: '24px', marginBottom: '2px', marginLeft: 'auto' }} />
            ) : (
              <div style={{ height: '24px', marginBottom: '2px' }} />
            )}
            <div style={{ borderBottom: '2px solid #1e633d', marginBottom: '2px' }} />
            <p style={{ color: '#1e633d', fontStyle: 'italic', fontWeight: 'bold', fontSize: '9px', margin: 0 }}>Financial Secretary's Signature</p>
          </div>
        </div>
      </div>
    );
  }
);

FacultyDuesReceipt.displayName = 'FacultyDuesReceipt';

export default FacultyDuesReceipt;
