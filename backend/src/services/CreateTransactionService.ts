// import AppError from '../errors/AppError';

import { getRepository, getCustomRepository } from 'typeorm';
import Transaction from '../models/Transaction';
import Category from '../models/Category';
import AppError from '../errors/AppError';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  title_category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    title_category,
  }: Request): Promise<Transaction> {
    const categoryRepository = getRepository(Category);
    const transactionRepository = getCustomRepository(TransactionsRepository);

    const balance = await transactionRepository.getBalance();

    if (type === 'outcome' && value > balance.total) {
      throw new AppError('Balance not available');
    }

    let transactionCategory = await categoryRepository.findOne({
      where: { title: title_category },
    });

    // if dont exists category
    if (!transactionCategory) {
      transactionCategory = categoryRepository.create({
        title: title_category,
      });
      await categoryRepository.save(transactionCategory);
      // category.id
    }
    const transaction = transactionRepository.create({
      title,
      type,
      value,
      category: transactionCategory,
    });

    await transactionRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
