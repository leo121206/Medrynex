export type DisputeReason = 
  | 'Unauthorized access' 
  | 'Incorrect emergency claim' 
  | 'Incorrect record accessed' 
  | 'Unexpected access duration' 
  | 'Other';

export interface Dispute {
  id: string;
  patientId: string;
  patientName: string;
  eventId: string;
  doctorName: string;
  hospital: string;
  accessDate: string;
  reason: DisputeReason;
  details: string;
  attachedDocName?: string;
  status: 'Open' | 'Under Investigation' | 'Resolved' | 'Rejected';
  onChainTxHash?: string;
  createdAt: string;
  updatedAt: string;
}
