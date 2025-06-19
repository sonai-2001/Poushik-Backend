export type JwtPayloadType = {
    id: string;
    iat?: string;
};

import { UserRole } from '@common/enum/user-role.enum';

export interface JwtPayload {
    id: string;
    role: {
        role: UserRole;
    };
}
