export { Candidate, Election, UserAccount, VoteBlock } from "@/class/entities";

export {
    AppError,
    AuthenticationError,
    DataAccessError,
    ValidationError
} from "@/class/errors";

export { AdminService } from "@/class/admin-class";
export { AuditorService } from "@/class/auditor-class";
export { AuthService } from "@/class/auth-class";
export { EmailService } from "@/class/email-service";
export {
    FaceRecognitionService,
    faceRecognitionService
} from "@/class/face-recognition";
export { FaceRepository, faceRepository } from "@/class/face-repository";
export { VotingService } from "@/class/voting-class";

export { ServiceFactory, serviceFactory } from "@/class/service-factory";
export { supabase } from "@/class/supabase-client";

export type {
    AddCandidateInput,
    CastVoteInput,
    CreateElectionInput,
    IAuditLogRepository,
    IAuthRepository,
    ICandidateRepository,
    IElectionRepository,
    IProfileRepository,
    IVoteLedgerRepository,
    IVoterRegistryRepository
} from "@/class/service-contracts";

export type {
    AuditLogRow,
    CandidateRow,
    ElectionRow,
    ElectionStatus,
    ProfileRow,
    UserRole,
    VerifyChainResultRow,
    VoteBlockRow,
    VoterRegistryRow,
    VoteVerificationReceipt
} from "@/class/database-types";

export type {
    FaceEmbeddingResult,
    FaceComparisonResult
} from "@/class/face-recognition";

export type { VoterFaceRow, VoterFaceEmbeddingRow, FaceImage } from "@/class/face-repository";

