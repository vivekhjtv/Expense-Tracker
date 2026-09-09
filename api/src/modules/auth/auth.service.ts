import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { hashPassword, verifyPassword } from './password.util';

export interface AuthResult {
  accessToken: string;
  user: { id: string; name: string; email: string };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.userModel.findOne({ email: dto.email }).exec();
    if (existing) {
      throw new ConflictException('An account with that email already exists.');
    }

    try {
      const user = await this.userModel.create({
        name: dto.name,
        email: dto.email,
        passwordHash: await hashPassword(dto.password),
      });

      this.logger.log(`Registered ${user.email}`);
      return this.issue(user);
    } catch (err) {
      // Two simultaneous signups with the same email both pass the check
      // above; the unique index is what actually decides, so translate its
      // error rather than returning a 500.
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictException('An account with that email already exists.');
      }
      throw err;
    }
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.userModel
      .findOne({ email: dto.email })
      .select('+passwordHash')
      .exec();

    // Verify against a dummy hash when the user is missing, so a request for
    // an unknown email takes the same time as one for a known email. Without
    // it, response timing reveals which addresses are registered.
    const stored = user?.passwordHash ?? DUMMY_HASH;
    const valid = await verifyPassword(dto.password, stored);

    if (!user || !valid) {
      throw new UnauthorizedException('That email or password is not right.');
    }

    return this.issue(user);
  }

  async findById(userId: Types.ObjectId): Promise<AuthResult['user']> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new UnauthorizedException('Your account no longer exists.');
    }
    return { id: user._id.toString(), name: user.name, email: user.email };
  }

  private async issue(user: UserDocument): Promise<AuthResult> {
    const accessToken = await this.jwtService.signAsync({
      sub: user._id.toString(),
      email: user.email,
    });

    return {
      accessToken,
      user: { id: user._id.toString(), name: user.name, email: user.email },
    };
  }
}

/** A real scrypt hash of a random value — never matches, but costs the same to check. */
const DUMMY_HASH =
  '00000000000000000000000000000000:' +
  '0'.repeat(128);
