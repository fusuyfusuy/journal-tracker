import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Subscriber } from '@journal/database';
import { Repository } from 'typeorm';
import { CreateSubscriberDto, UpdateSubscriberDto } from './subscribers.dto';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const URL = /^https?:\/\/.+/i;

@Injectable()
export class SubscribersService {
  constructor(@InjectRepository(Subscriber) private readonly repo: Repository<Subscriber>) {}

  list(): Promise<Subscriber[]> {
    return this.repo.find();
  }

  async get(id: number): Promise<Subscriber> {
    const s = await this.repo.findOneBy({ id });
    if (!s) throw new NotFoundException(`subscriber ${id} not found`);
    return s;
  }

  create(dto: CreateSubscriberDto): Promise<Subscriber> {
    this.validateDestination(dto.channel_type, dto.destination);
    return this.repo.save(this.repo.create({ ...dto, active: dto.active ?? true }));
  }

  async update(id: number, dto: UpdateSubscriberDto): Promise<Subscriber> {
    const existing = await this.get(id);
    if (dto.destination !== undefined) {
      this.validateDestination(existing.channel_type, dto.destination);
    }
    Object.assign(existing, dto);
    return this.repo.save(existing);
  }

  async remove(id: number): Promise<void> {
    const { affected } = await this.repo.delete(id);
    if (!affected) throw new NotFoundException(`subscriber ${id} not found`);
  }

  private validateDestination(channel: 'email' | 'webhook', destination: string): void {
    const pattern = channel === 'email' ? EMAIL : URL;
    if (!pattern.test(destination)) {
      throw new BadRequestException(`destination does not match channel "${channel}"`);
    }
  }
}
