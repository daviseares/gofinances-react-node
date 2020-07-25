import { getRepository, getCustomRepository, In } from 'typeorm';
import csvParse from 'csv-parse';
import fs from 'fs';
import TranscationsRepository from '../repositories/TransactionsRepository';
import Transaction from '../models/Transaction';
import Category from '../models/Category';

interface CSVTransaction {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}
class ImportTransactionsService {
  async execute(csvfilePath: string): Promise<Transaction[]> {
    const categoriesRepository = getRepository(Category);
    const transactionsRepository = getCustomRepository(TranscationsRepository);

    const readCSVStream = fs.createReadStream(csvfilePath);

    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    const parseStream = csvParse({
      from_line: 2,
    });

    const parseCSV = readCSVStream.pipe(parseStream);

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      if (!title || !type || !value) return;

      categories.push(category);

      transactions.push({ title, type, value, category });
    });

    await new Promise(resolve => parseCSV.on('end', resolve));

    // pega categoria existente no banco
    const existCategories = await categoriesRepository.find({
      where: {
        title: In(categories),
      },
    });

    // retorna titulo das caetgorias existentes
    const existCategoriesTitle = existCategories.map(
      (category: Category) => category.title,
    );

    // pega só as categorias que não existem no banco
    const addCategoryTitles = categories
      .filter(category => !existCategoriesTitle.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    // cria categorias no banco
    const newCategories = categoriesRepository.create(
      addCategoryTitles.map(title => ({
        title,
      })),
    );

    await categoriesRepository.save(newCategories);

    const finalCategories = [...newCategories, ...existCategories];

    const createTransactions = transactionsRepository.create(
      transactions.map(transaction => ({
        ...transaction,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionsRepository.save(createTransactions);

    await fs.promises.unlink(csvfilePath);

    return createTransactions;
  }
}

export default ImportTransactionsService;
