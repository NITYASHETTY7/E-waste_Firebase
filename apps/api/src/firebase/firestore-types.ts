// ─── Enums (Replaces Prisma Enums) ───────────────────────────────────────────

export enum UserRole {
  ADMIN = 'ADMIN',
  CLIENT = 'CLIENT',
  VENDOR = 'VENDOR',
  USER = 'USER',
}

export enum CompanyStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  BLOCKED = 'BLOCKED',
}

export enum CompanyType {
  CLIENT = 'CLIENT',
  VENDOR = 'VENDOR',
}

export enum RequirementStatus {
  UPLOADED = 'UPLOADED',
  PROCESSING = 'PROCESSING',
  CLIENT_REVIEW = 'CLIENT_REVIEW',
  FINALIZED = 'FINALIZED',
  REJECTED = 'REJECTED',
}

export enum AuditStatus {
  INVITED = 'INVITED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
}

export enum AuctionStatus {
  DRAFT = 'DRAFT',
  UPCOMING = 'UPCOMING',
  SEALED_PHASE = 'SEALED_PHASE',
  OPEN_PHASE = 'OPEN_PHASE',
  PENDING_SELECTION = 'PENDING_SELECTION',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  CLIENT_REVIEW = 'CLIENT_REVIEW',
}

export enum BidPhase {
  SEALED = 'SEALED',
  OPEN = 'OPEN',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

export enum PickupStatus {
  PENDING = 'PENDING',
  SCHEDULED = 'SCHEDULED',
  DOCUMENTS_UPLOADED = 'DOCUMENTS_UPLOADED',
  COMPLETED = 'COMPLETED',
  GATE_PASS_ISSUED = 'GATE_PASS_ISSUED',
  VENDOR_ACKNOWLEDGED = 'VENDOR_ACKNOWLEDGED',
  IN_TRANSIT = 'IN_TRANSIT',
  RECONCILIATION_DONE = 'RECONCILIATION_DONE',
  INVOICE_GENERATED = 'INVOICE_GENERATED',
}

export enum UserProductStatus {
  PENDING_ADMIN_REVIEW = 'PENDING_ADMIN_REVIEW',
  ADMIN_APPROVED = 'ADMIN_APPROVED',
  QUOTE_RECEIVED = 'QUOTE_RECEIVED',
  QUOTE_ACCEPTED = 'QUOTE_ACCEPTED',
  PICKUP_REQUESTED = 'PICKUP_REQUESTED',
  PICKUP_IN_PROGRESS = 'PICKUP_IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

export enum DocumentType {
  GST_CERTIFICATE = 'GST_CERTIFICATE',
  PAN_CARD = 'PAN_CARD',
  PCB_AUTHORIZATION = 'PCB_AUTHORIZATION',
  EPR_AUTHORIZATION = 'EPR_AUTHORIZATION',
  POLLUTION_CERTIFICATE = 'POLLUTION_CERTIFICATE',
  TRADE_LICENSE = 'TRADE_LICENSE',
  PRICE_SHEET = 'PRICE_SHEET',
  FINAL_QUOTE = 'FINAL_QUOTE',
  LETTERHEAD_QUOTATION = 'LETTERHEAD_QUOTATION',
  PAYMENT_PROOF = 'PAYMENT_PROOF',
  FORM_6 = 'FORM_6',
  WEIGHT_SLIP_EMPTY = 'WEIGHT_SLIP_EMPTY',
  WEIGHT_SLIP_LOADED = 'WEIGHT_SLIP_LOADED',
  RECYCLING_CERTIFICATE = 'RECYCLING_CERTIFICATE',
  DISPOSAL_CERTIFICATE = 'DISPOSAL_CERTIFICATE',
  AUDIT_GEO_PHOTO = 'AUDIT_GEO_PHOTO',
  CERTIFICATE_OF_INCORPORATION = 'CERTIFICATE_OF_INCORPORATION',
  COMPANY_PAN = 'COMPANY_PAN',
  DIRECTOR_PAN = 'DIRECTOR_PAN',
  AUTHORIZED_SIGNATORY_ID = 'AUTHORIZED_SIGNATORY_ID',
  BOARD_RESOLUTION = 'BOARD_RESOLUTION',
  KYC_FORM = 'KYC_FORM',
  EMD_PROOF = 'EMD_PROOF',
  TERMS_ACCEPTANCE = 'TERMS_ACCEPTANCE',
  RECYCLER_LICENSE = 'RECYCLER_LICENSE',
  FACTORY_LICENSE = 'FACTORY_LICENSE',
  BUSINESS_INSURANCE = 'BUSINESS_INSURANCE',
  VENDOR_ONBOARDING_FORM = 'VENDOR_ONBOARDING_FORM',
  AUTHORIZATION_LETTER = 'AUTHORIZATION_LETTER',
  ADDRESS_PROOF = 'ADDRESS_PROOF',
  E_WASTE_DECLARATION = 'E_WASTE_DECLARATION',
  AADHAR_CARD = 'AADHAR_CARD',
  CANCELLED_CHEQUE = 'CANCELLED_CHEQUE',
  OTHER = 'OTHER',
  WORK_ORDER = 'WORK_ORDER',
  PURCHASE_ORDER = 'PURCHASE_ORDER',
  AGREEMENT = 'AGREEMENT',
  DELIVERY_CHALLAN = 'DELIVERY_CHALLAN',
  ASSET_HANDOVER_FORM = 'ASSET_HANDOVER_FORM',
  MATERIAL_ACKNOWLEDGEMENT = 'MATERIAL_ACKNOWLEDGEMENT',
  DATA_DESTRUCTION_CERTIFICATE = 'DATA_DESTRUCTION_CERTIFICATE',
  EWASTE_RECYCLING_CERTIFICATE = 'EWASTE_RECYCLING_CERTIFICATE',
  EWAY_BILL = 'EWAY_BILL',
  E_WASTE_MANIFEST = 'E_WASTE_MANIFEST',
  INVOICE = 'INVOICE',
}

// ─── Sub-document Structs (Embedded as arrays/objects) ─────────────────────────

export interface S3Document {
  id: string;
  type: DocumentType;
  s3Key: string;
  s3Bucket: string;
  fileName: string;
  mimeType?: string | null;
  uploadedAt: Date;
}

export interface AuditPhoto {
  id: string;
  s3Key: string;
  s3Bucket: string;
  fileName: string;
  mimeType?: string | null;
  uploadedAt: Date;
  capturedAt?: Date | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface AuditReport {
  id: string;
  productMatch?: boolean | null;
  remarks?: string | null;
  completedAt?: Date | null;
  vendorUserId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  photos: AuditPhoto[];
}

export interface AuditInvitationDoc {
  id: string;
  status: AuditStatus;
  vendorId: string;
  siteAddress?: string | null;
  spocName?: string | null;
  spocPhone?: string | null;
  scheduledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  respondedAt?: Date | null;
  token?: string | null;
  report?: AuditReport | null;
}

export interface VendorAuditDocDoc {
  id: string;
  vendorUserId: string;
  auditReportS3Key?: string | null;
  auditReportFileName?: string | null;
  excelS3Key?: string | null;
  excelFileName?: string | null;
  imageS3Keys: string[];
  imageFileNames: string[];
  status: string;
  adminRemarks?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BidDoc {
  id: string;
  amount: number;
  phase: BidPhase;
  remarks?: string | null;
  rank?: number | null;
  vendorId: string;
  priceSheetS3Key?: string | null;
  priceSheetS3Bucket?: string | null;
  priceSheetFileName?: string | null;
  createdAt: Date;
  isShortlisted: boolean;
  clientRemarks?: string | null;
  clientStatus: string;
}

export interface PickupDoc {
  id: string;
  status: PickupStatus;
  scheduledDate?: Date | null;
  adminNotes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  finalWeight?: number | null;
  gatePassNumber?: string | null;
  gatePassIssuedAt?: Date | null;
  vehicleNumber?: string | null;
  driverName?: string | null;
  pickupNotes?: string | null;
  vendorAcknowledgedAt?: Date | null;
  reconciliationNotes?: string | null;
  finalAmount?: number | null;
  invoiceNumber?: string | null;
  invoiceGeneratedAt?: Date | null;
  invoiceS3Key?: string | null;
  gatePassDocS3Key?: string | null;
  gatePassDocBucket?: string | null;
  gatePassDocFileName?: string | null;
  vendorVehicleNumber?: string | null;
  vendorDriverName?: string | null;
  vendorPreferredDate?: Date | null;
  clientVerifiedAt?: Date | null;
  pickupDocs: S3Document[];
}

export interface PaymentDoc {
  id: string;
  status: PaymentStatus;
  clientAmount: number;
  commissionAmount: number;
  totalAmount: number;
  utrNumber?: string | null;
  proofS3Key?: string | null;
  proofS3Bucket?: string | null;
  adminNotes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  paymentProofUrl?: string | null;
}

export interface InAppNotificationDoc {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  createdAt: Date;
}

export interface UserProductQuoteDoc {
  id: string;
  vendorCompanyId: string;
  offeredPrice: number;
  remarks?: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProductPickupDoc {
  id: string;
  vendorCompanyId: string;
  status: string;
  scheduledDate?: Date | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Main Firestore Collection Documents ────────────────────────────────────────

export interface UserDoc {
  id: string; // Document ID is also Firebase Auth UID
  email: string;
  passwordHash?: string; // Kept if needed, but Firebase Auth manages passwords
  name: string;
  phone?: string | null;
  role: UserRole;
  companyId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  emailVerified: boolean;
  isActive: boolean;
  otpAttempts?: number;
  otpCode?: string | null;
  otpExpiresAt?: Date | null;
  otpType?: string | null;
  phoneVerified: boolean;
  address?: string | null;
  bankAccountHolder?: string | null;
  bankAccountNumber?: string | null;
  bankAccountType?: string | null;
  bankIfscCode?: string | null;
  bankName?: string | null;
  dob?: string | null;
  panNumber?: string | null;
}

export interface CompanyDoc {
  id: string; // Document ID
  name: string;
  type: CompanyType;
  status: CompanyStatus;
  gstNumber?: string | null;
  panNumber?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  rating?: number | null;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
  bankAccountHolder?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankIfscCode?: string | null;
  bankAccountType?: string | null;
  isLocked: boolean;
  lockReason?: string | null;
  penaltyAmount?: number | null;
}

export interface RequirementDoc {
  id: string; // Document ID
  title: string;
  description?: string | null;
  status: RequirementStatus;
  rawS3Key?: string | null;
  processedS3Key?: string | null;
  targetPrice?: number | null;
  totalWeight?: number | null;
  category?: string | null;
  clientId: string;
  createdAt: Date;
  updatedAt: Date;
  adminApprovedAt?: Date | null;
  adminApprovedById?: string | null;
  invitedVendorIds: string[];
  sealedPhaseEnd?: Date | null;
  sealedPhaseStart?: Date | null;
  acceptedVendorIds: string[];
  declinedVendorIds: string[];
  auditApprovedVendorIds: string[];
  sealedBidDeadline?: Date | null;
  sealedBidEventCreatedAt?: Date | null;
  clientDocuments?: string; // Store as JSON string or string array
}

export interface AuctionDoc {
  id: string; // Document ID
  title: string;
  category: string;
  description?: string | null;
  status: AuctionStatus;
  basePrice: number;
  targetPrice?: number | null;
  tickSize: number;
  maxTicks: number;
  extensionMinutes: number;
  sealedPhaseStart?: Date | null;
  sealedPhaseEnd?: Date | null;
  openPhaseStart?: Date | null;
  openPhaseEnd?: Date | null;
  extensionCount: number;
  liveApprovalStatus: string;
  liveApprovalRemarks?: string | null;
  clientId: string;
  winnerId?: string | null;
  requirementId?: string | null;
  quoteApproved?: boolean | null;
  quoteRemarks?: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  auctionDocs: S3Document[]; // Embedded array to save reads
}

export interface RatingDoc {
  id: string; // Document ID
  auctionId: string;
  fromCompanyId: string;
  toCompanyId: string;
  score: number;
  comment?: string | null;
  type: string;
  createdAt: Date;
}

export interface UserProductDoc {
  id: string; // Document ID
  userId: string;
  name: string;
  weightKg: number;
  condition: string;
  askingPrice: number;
  description?: string | null;
  photoS3Keys: string[];
  photoS3Bucket?: string | null;
  invoiceS3Key?: string | null;
  invoiceS3Bucket?: string | null;
  invoiceFileName?: string | null;
  status: UserProductStatus;
  adminApprovedAt?: Date | null;
  adminRemarks?: string | null;
  acceptedQuoteId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
