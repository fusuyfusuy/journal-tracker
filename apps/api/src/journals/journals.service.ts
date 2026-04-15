import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Journal } from '@journal/database';
import { Repository } from 'typeorm';
import { CreateJournalDto, UpdateJournalDto } from './journals.dto';

@Injectable()
export class JournalsService {
  constructor(@InjectRepository(Journal) private readonly repo: Repository<Journal>) {}

  list(): Promise<Journal[]> {
    return this.repo.find();
  }

  async get(id: number): Promise<Journal> {
    const j = await this.repo.findOneBy({ id });
    if (!j) throw new NotFoundException(`journal ${id} not found`);
    return j;
  }

  create(dto: CreateJournalDto): Promise<Journal> {
    return this.repo.save(this.repo.create({ ...dto, active: dto.active ?? true }));
  }

  async update(id: number, dto: UpdateJournalDto): Promise<Journal> {
    const existing = await this.get(id);
    Object.assign(existing, dto);
    return this.repo.save(existing);
  }

  async remove(id: number): Promise<void> {
    const { affected } = await this.repo.delete(id);
    if (!affected) throw new NotFoundException(`journal ${id} not found`);
  }
}
