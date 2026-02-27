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
        width: '850px',
        height: '750px',
        backgroundColor: '#f9fdfa',
        border: '1px solid #d1d5db',
        position: 'relative',
        padding: '24px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        boxSizing: 'border-box',
        fontFamily: "'Times New Roman', Georgia, serif",
      }}>
        {/* Inner border */}
        <div style={{
          position: 'absolute', top: '10px', left: '10px', right: '10px', bottom: '10px',
          border: '1.5px solid #2d7a4d', pointerEvents: 'none', borderRadius: '2px',
        }} />

        {/* Watermark */}
        <img src={nuesaLogo} alt="" crossOrigin="anonymous" style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          opacity: 0.08, width: '500px', zIndex: 0, pointerEvents: 'none',
        }} />

        {/* Header */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <img src={nuesaLogo} alt="NUESA" crossOrigin="anonymous" style={{ width: '192px', height: '192px', objectFit: 'contain' }} />
          <div style={{ textAlign: 'center', flex: 1, padding: '0 12px' }}>
            <h1 style={{ fontFamily: "'Times New Roman', Georgia, serif", fontSize: '16px', fontWeight: 'bold', color: '#1e633d', letterSpacing: '0.05em', margin: 0 }}>
              NIGERIA UNIVERSITIES ENGINEERING
            </h1>
            <h1 style={{ fontFamily: "'Times New Roman', Georgia, serif", fontSize: '16px', fontWeight: 'bold', color: '#1e633d', letterSpacing: '0.05em', margin: 0 }}>
              STUDENT' ASSOCIATION (NUESA)
            </h1>
            <h2 style={{ fontFamily: "'Times New Roman', Georgia, serif", fontSize: '14px', fontWeight: 'bold', color: '#1e633d', marginTop: '4px', margin: '4px 0 0' }}>
              UNIVERSITY OF ABUJA CHAPTER
            </h2>
            <div style={{
              display: 'inline-block', background: '#1e633d', color: 'white',
              padding: '3px 16px', borderRadius: '20px', fontSize: '12px',
              fontWeight: 'bold', letterSpacing: '0.05em', marginTop: '8px',
            }}>
              FACULTY DUES RECEIPT
            </div>
          </div>
          <img src={uniabujaLogo} alt="UniAbuja" crossOrigin="anonymous" style={{ width: '192px', height: '192px', objectFit: 'contain' }} />
        </div>

        {/* Date + ID */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '18px' }}>
          <table style={{ borderCollapse: 'collapse', textAlign: 'center', fontSize: '11px' }}>
            <thead>
              <tr style={{ background: '#1e633d', color: 'white', fontWeight: 'bold' }}>
                <td style={{ border: '1px solid #2d7a4d', padding: '3px 10px' }}>DAY</td>
                <td style={{ border: '1px solid #2d7a4d', padding: '3px 10px' }}>MONTH</td>
                <td style={{ border: '1px solid #2d7a4d', padding: '3px 10px' }}>YEAR</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #2d7a4d', height: '24px', width: '36px', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>{day}</td>
                <td style={{ border: '1px solid #2d7a4d', height: '24px', width: '60px', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>{month}</td>
                <td style={{ border: '1px solid #2d7a4d', height: '24px', width: '48px', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>{year}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '6px' }}>
              <span style={{ color: '#1e633d', fontWeight: 'bold', fontSize: '13px', marginRight: '6px' }}>NO:</span>
              <div style={{ width: '120px', borderBottom: '2px solid #1e633d', textAlign: 'center', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>
                {data.receiptNumber}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <span style={{ color: '#1e633d', fontWeight: 'bold', fontSize: '13px', marginRight: '6px' }}>Matric No:</span>
              <div style={{ width: '120px', border: '1px solid #1e633d', height: '24px', lineHeight: '24px', textAlign: 'center', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>
                {data.matricNumber}
              </div>
            </div>
          </div>
        </div>

        {/* Form fields */}
        <div style={{ position: 'relative', zIndex: 10 }}>
          {/* Received from */}
          <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '14px' }}>
            <span style={{ color: '#1e633d', fontStyle: 'italic', fontWeight: 'bold', fontSize: '14px', whiteSpace: 'nowrap' }}>Received from:</span>
            <div style={{ borderBottom: '2px solid #1e633d', flexGrow: 1, marginLeft: '8px', textAlign: 'left', paddingLeft: '6px' }}>
              <span style={{ fontWeight: 'bold', color: '#000', fontSize: '14px' }}>{data.fullName}</span>
            </div>
          </div>

          {/* Total sum of */}
          <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '14px' }}>
            <span style={{ color: '#1e633d', fontStyle: 'italic', fontWeight: 'bold', fontSize: '14px', whiteSpace: 'nowrap' }}>Total sum of:</span>
            <div style={{ borderBottom: '2px solid #1e633d', flexGrow: 1, marginLeft: '8px', textAlign: 'left', paddingLeft: '6px' }}>
              <span style={{ fontWeight: 'bold', color: '#000', fontSize: '14px' }}>{data.amountInWords}</span>
            </div>
          </div>

          {/* Naira / Kobo row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '14px' }}>
            <div style={{ borderBottom: '2px solid #1e633d', flexGrow: 1 }} />
            <span style={{ color: '#1e633d', fontStyle: 'italic', fontWeight: 'bold', fontSize: '14px', margin: '0 10px' }}>Naira</span>
            <div style={{ width: '100px', borderBottom: '2px solid #1e633d', textAlign: 'center' }}>
              <span style={{ fontWeight: 'bold', color: '#000', fontSize: '14px' }}>{data.amountNaira.toLocaleString()}</span>
            </div>
            <span style={{ color: '#1e633d', fontStyle: 'italic', fontWeight: 'bold', fontSize: '14px', margin: '0 14px' }}>kobo</span>
            <div style={{ width: '60px', borderBottom: '2px solid #1e633d', textAlign: 'center' }}>
              <span style={{ fontWeight: 'bold', color: '#000', fontSize: '14px' }}>{data.amountKobo.toString().padStart(2, '0')}</span>
            </div>
          </div>

          {/* Being payment for - single line only */}
          <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '18px' }}>
            <span style={{ color: '#1e633d', fontStyle: 'italic', fontWeight: 'bold', fontSize: '14px', whiteSpace: 'nowrap' }}>Being payment for:</span>
            <div style={{ borderBottom: '2px solid #1e633d', flexGrow: 1, marginLeft: '8px', textAlign: 'left', paddingLeft: '6px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              <span style={{ fontWeight: 'bold', color: '#000', fontSize: '14px' }}>{data.paymentFor}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          position: 'absolute', bottom: '20px', left: '24px', right: '24px', zIndex: 10,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        }}>
          <div style={{ width: '30%' }}>
            {data.presidentSignatureUrl ? (
              <img src={data.presidentSignatureUrl} alt="President" crossOrigin="anonymous" style={{ height: '160px', marginBottom: '4px', objectFit: 'contain', display: 'block', marginLeft: 'auto', marginRight: 'auto' }} />
            ) : (
              <div style={{ height: '160px', marginBottom: '4px' }} />
            )}
            <p style={{ color: '#1e633d', fontStyle: 'italic', fontWeight: 'bold', fontSize: '11px', margin: 0 }}>President's Signature</p>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center',
            border: '2px solid #1e633d', borderRadius: '2px',
            padding: '4px 12px', background: 'white',
          }}>
            <span style={{ color: '#1e633d', fontWeight: 'bold', fontSize: '18px', marginRight: '6px' }}>₦</span>
            <div style={{ width: '90px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontWeight: 'bold', color: '#000', fontSize: '16px' }}>{data.amountNaira.toLocaleString()}</span>
            </div>
            <span style={{ color: '#1e633d', fontWeight: 'bold', fontSize: '18px', margin: '0 6px' }}>:</span>
            <span style={{ color: '#1e633d', fontWeight: 'bold', fontSize: '18px' }}>K</span>
            <span style={{ fontWeight: 'bold', color: '#000', fontSize: '16px', marginLeft: '4px' }}>{data.amountKobo.toString().padStart(2, '0')}</span>
          </div>

          <div style={{ width: '30%', textAlign: 'right' }}>
            {data.financialSecretarySignatureUrl ? (
              <img src={data.financialSecretarySignatureUrl} alt="Fin. Secretary" crossOrigin="anonymous" style={{ height: '160px', marginBottom: '4px', objectFit: 'contain', display: 'block', marginLeft: 'auto', marginRight: 'auto' }} />
            ) : (
              <div style={{ height: '160px', marginBottom: '4px' }} />
            )}
            <div style={{ borderBottom: '2px solid #1e633d', marginBottom: '4px' }} />
            <p style={{ color: '#1e633d', fontStyle: 'italic', fontWeight: 'bold', fontSize: '11px', margin: 0 }}>Financial Secretary's Signature</p>
          </div>
        </div>
      </div>
    );
  }
);

FacultyDuesReceipt.displayName = 'FacultyDuesReceipt';

export default FacultyDuesReceipt;
