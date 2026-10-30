import { User } from '../users/user.entity'
import { AuthSession } from '../auth/auth-session.entity'
import { PasswordReset } from '../auth/password-reset.entity'
import { Room } from '../rooms/entities/room.entity'
import { Item } from '../rooms/entities/item.entity'
import { Criterion } from '../rooms/entities/criterion.entity'
import { Vote } from '../rooms/entities/vote.entity'
import { Guest } from '../guests/guest.entity'
import { Outcome } from '../rooms/entities/outcome.entity'

export const ENTITIES = [User, AuthSession, PasswordReset, Room, Item, Criterion, Vote, Outcome, Guest]
