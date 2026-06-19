export type UserRole = 'client' | 'vendor' | 'admin' | 'guest' | 'consumer' | 'user';

export interface UploadedDoc {
  name: string;
  fileName: string;
  size: string;
  uploadedAt: string;
  status: 'pending' | 'verified' | 'rejected';
  url?: string;
  signedUrl?: string;
  s3Key?: string;
  s3Bucket?: string;
  _rawFile?: File;
}

export const DOC_KEY_TO_TYPE: Record<string, string> = {
  company_reg: 'CERTIFICATE_OF_INCORPORATION',
  gst_cert: 'GST_CERTIFICATE',
  company_pan: 'COMPANY_PAN',
  pan_card: 'PAN_CARD',
  signatory_id: 'AUTHORIZED_SIGNATORY_ID',
  board_resolution: 'BOARD_RESOLUTION',
  kyc_form: 'KYC_FORM',
  emd_proof: 'EMD_PROOF',
  terms: 'TERMS_ACCEPTANCE',
  pcb_auth: 'PCB_AUTHORIZATION',
  recycler_license: 'RECYCLER_LICENSE',
  factory_license: 'FACTORY_LICENSE',
  epr_cert: 'EPR_AUTHORIZATION',
  insurance: 'BUSINESS_INSURANCE',
  vendor_onboarding: 'VENDOR_ONBOARDING_FORM',
  incorporation_cert: 'CERTIFICATE_OF_INCORPORATION',
  auth_letter: 'AUTHORIZATION_LETTER',
  address_proof: 'ADDRESS_PROOF',
  e_waste_declaration: 'E_WASTE_DECLARATION',
  aadhar_card: 'AADHAR_CARD',
  gst_card: 'GST_CERTIFICATE',
  cancelled_cheque: 'CANCELLED_CHEQUE',
};

export interface BankDetails {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  accountType: 'current' | 'savings';
  cancelledCheque?: UploadedDoc;
}

export interface OnboardingProfile {
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  // Vendor specific
  companyRegistrationNo?: string;
  processingCapacity?: string;
  materialSpecializations?: string[];
  cpcbNo?: string;
  // Client specific
  gstin?: string;
  industrySector?: string;
  numberOfEmployees?: string;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  password?: string;
  phone?: string;
  avatar?: string;
  companyId?: string;
  status: 'active' | 'pending' | 'rejected' | 'disabled' | 'on-hold';
  statusReason?: string;
  onboardingStep: number; // 1-4, or 5 = complete
  onboardingProfile?: OnboardingProfile;
  documents?: UploadedDoc[];
  bankDetails?: BankDetails;
  registeredAt?: string;
  penaltyAmount?: number;
  isLocked?: boolean;
  lockReason?: string;
  rating?: number;
}

export interface AuditInvitation {
  id: string;
  listingId: string;
  vendorId: string;
  vendorName: string;
  status: 'invited' | 'accepted' | 'declined' | 'completed';
  scheduledDate?: string;
  spocName?: string;
  spocPhone?: string;
  siteAddress?: string;
  productMatch?: boolean;
  auditRemarks?: string;
  completedAt?: string;
  invitedAt: string;
}

export interface VendorRating {
  id: string;
  listingId: string;
  vendorId: string;
  vendorName: string;
  clientId: string;
  clientName: string;
  overallRating: number;     // 1-5
  auditRating?: number;      // 1-5
  timelinessRating?: number; // 1-5
  complianceRating?: number; // 1-5
  comment?: string;
  createdAt: string;
}

export interface Listing {
  id: string;
  title: string;
  category: string;
  subCategory?: string;
  weight: number;
  location: string;
  locationType?: string;
  status: 'pending' | 'verified' | 'active' | 'completed' | 'cancelled' | 'rejected' | 'on-hold';
  statusReason?: string;
  adminStatus?: 'pending' | 'accepted' | 'rejected';
  assignedVendorId?: string;
  assignedVendorName?: string;
  auctionPhase?: 'draft' | 'invitation_window' | 'sealed_bid' | 'open_configuration' | 'live' | 'completed';
  invitedVendorIds?: string[];
  acceptedVendorIds?: string[];
  declinedVendorIds?: string[];
  vendorResponses?: { vendorId: string; status: 'interested' | 'declined'; respondedAt?: string }[];
  price?: number;
  userId: string;
  userName?: string;
  createdAt: string;
  description: string;
  imageUrl?: string;
  images?: string[];
  documents?: { name: string; url: string; type: string }[];
  closingDocuments?: { name: string; url: string; type: string; timestamp: string }[];
  sealedBidStartDate?: string;
  sealedBidEndDate?: string;
  auctionStartDate?: string;
  auctionEndDate?: string;
  invitationDeadline?: string;
  basePrice?: number;
  targetPrice?: number;
  highestEmdAmount?: number;
  bidIncrement?: number;
  maximumTickSize?: number;
  extensionTime?: number;
  maxExtensions?: number;
  currentExtensions?: number;
  urgency?: 'low' | 'medium' | 'high';
  pickupAddress?: string;
  viewCount?: number;
  bidCount?: number;
  // Auction identity
  auctionId?: string;
  liveConfigured?: boolean;
  // Requirement upload flow
  requirementId?: string;
  requirementStatus?: 'pending' | 'processing' | 'client_review' | 'finalized' | 'rejected';
  processedSheetUrl?: string;
  // Winner info (post-auction)
  winnerVendorId?: string;
  winnerVendorName?: string;
  // Final quote flow
  finalQuoteStatus?: 'pending' | 'submitted' | 'client_reviewing' | 'approved' | 'rejected';
  finalQuoteProductUrl?: string;
  finalQuoteLetterheadUrl?: string;
  finalQuoteSubmittedAt?: string;
  finalQuoteRemarks?: string;
  // Step 6 — Purchase Order
  poStatus?: 'pending' | 'issued' | 'acknowledged';
  poNumber?: string;
  poIssuedAt?: string;
  poPaymentTerms?: string;
  poDeliveryTerms?: string;
  poPenaltyClause?: string;
  poSpecialConditions?: string;
  // Step 6 — EMD (Earnest Money Deposit)
  emdStatus?: 'not_required' | 'pending' | 'submitted' | 'verified';
  emdAmount?: number;
  emdUTR?: string;
  emdSubmittedAt?: string;
  // Payment flow
  paymentStatus?: 'pending' | 'proof_uploaded' | 'confirmed';
  paymentClientAmount?: number;
  paymentCommissionAmount?: number;
  paymentProofUrl?: string;
  paymentUTR?: string;
  paymentSubmittedAt?: string;
  // Step 7 — Handover Documents
  handoverStatus?: 'pending' | 'created' | 'acknowledged';
  handoverGatePass?: string;
  handoverVehicle?: string;
  handoverDriver?: string;
  handoverDate?: string;
  handoverNotes?: string;
  // Step 8 — Final Reconciliation
  reconciliationStatus?: 'pending' | 'submitted' | 'verified';
  reconciliationFinalWeight?: number;
  reconciliationFinalQuantity?: number;
  reconciliationFinalValue?: number;
  reconciliationDocUrl?: string;
  reconciliationNotes?: string;
  reconciliationSubmittedAt?: string;
  // Compliance flow
  complianceStatus?: 'pending' | 'pickup_scheduled' | 'documents_uploaded' | 'verified';
  pickupScheduledDate?: string;
  form6Url?: string;
  weightSlipEmptyUrl?: string;
  weightSlipLoadedUrl?: string;
  recyclingCertUrl?: string;
  disposalCertUrl?: string;
}

export interface Bid {
  id: string;
  listingId: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  type: 'sealed' | 'open';
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  statusReason?: string;
  emdPaid?: boolean;
  createdAt: string;
  note?: string;
  expiresAt?: string;
  // Sealed bid submission fields
  auditReportUrl?: string;
  auditReportFileName?: string;
  priceSheetUrl?: string;
  priceSheetFileName?: string;
  imageUrls?: string[];
  imageFileNames?: string[];
  clientStatus?: 'pending' | 'approved' | 'rejected';
  clientRemarks?: string;
  auctionId?: string;
  vendor?: { id: string; name: string; email?: string; companyId?: string };
}

export interface Notification {
  id: string;
  userId: string;
  type: 'bid_received' | 'bid_accepted' | 'bid_rejected' | 'listing_approved' | 'account_approved' | 'general' | 'audit_approved' | 'audit_rejected' | 'sealed_bid_event' | 'live_auction_approval' | 'live_auction_approved';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface AppState {
  currentUser: User | null;
  listings: Listing[];
  bids: Bid[];
  users: User[];
  notifications: Notification[];
  auditInvitations: AuditInvitation[];
  vendorRatings: VendorRating[];
  pendingOnboardingRole?: 'client' | 'vendor' | 'consumer';
  pendingOnboardingEmail?: string;
  pendingOnboardingPassword?: string;
  isSidebarOpen: boolean;
  isSidebarCollapsed: boolean;
  theme: 'light' | 'dark';
}
