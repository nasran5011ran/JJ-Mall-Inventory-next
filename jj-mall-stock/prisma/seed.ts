import { PrismaClient, Role, TransactionType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding for JJ Mall...');

  // 1. Create Users (Default password: '1234')
  const hashedPasswordAdmin = await bcrypt.hash('1234', 10);
  const hashedPasswordStaff = await bcrypt.hash('1234', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { password: hashedPasswordAdmin },
    create: {
      username: 'admin',
      password: hashedPasswordAdmin,
      name: 'ผู้ดูแลระบบ (Admin)',
      role: Role.ADMIN,
      status: 'ACTIVE',
    },
  });

  const staff = await prisma.user.upsert({
    where: { username: 'staff' },
    update: { password: hashedPasswordStaff },
    create: {
      username: 'staff',
      password: hashedPasswordStaff,
      name: 'สมชาย พนักงานขาย (Staff)',
      role: Role.STAFF,
      status: 'ACTIVE',
    },
  });

  console.log('✅ Users created:', { admin: admin.username, staff: staff.username });

  // 2. Create Ingredients
  const ingredientsData = [
    { code: 'ING-MILO001', name: 'ผงไมโล', category: 'ผงเครื่องดื่ม', unit: 'กรัม', currentStock: 5000, minStock: 1000, costPerUnit: 0.25 },
    { code: 'ING-SUG001', name: 'น้ำตาลทราย', category: 'เครื่องปรุง', unit: 'กรัม', currentStock: 10000, minStock: 2000, costPerUnit: 0.03 },
    { code: 'ING-MILK001', name: 'นมข้นหวาน', category: 'เครื่องปรุง', unit: 'มิลลิลิตร', currentStock: 4000, minStock: 1000, costPerUnit: 0.08 },
    { code: 'ING-CUP001', name: 'แก้วพลาสติก 22oz', category: 'บรรจุภัณฑ์', unit: 'ใบ', currentStock: 500, minStock: 100, costPerUnit: 1.50 },
    { code: 'ING-LID001', name: 'ฝาแก้วโดม', category: 'บรรจุภัณฑ์', unit: 'ชิ้น', currentStock: 500, minStock: 100, costPerUnit: 0.80 },
    { code: 'ING-STR001', name: 'หลอดดูดหุ้มฟิล์ม', category: 'บรรจุภัณฑ์', unit: 'อัน', currentStock: 1000, minStock: 200, costPerUnit: 0.30 },
    { code: 'ING-TEA001', name: 'ใบชาไทยพรีเมียม', category: 'ผงเครื่องดื่ม', unit: 'กรัม', currentStock: 3000, minStock: 500, costPerUnit: 0.35 },
    { code: 'ING-COF001', name: 'ผงกาแฟโบราณ', category: 'ผงเครื่องดื่ม', unit: 'กรัม', currentStock: 3000, minStock: 500, costPerUnit: 0.30 },
  ];

  const createdIngredients: Record<string, any> = {};

  for (const item of ingredientsData) {
    const ing = await prisma.ingredient.upsert({
      where: { code: item.code },
      update: {
        name: item.name,
        category: item.category,
        unit: item.unit,
        currentStock: item.currentStock,
        minStock: item.minStock,
        costPerUnit: item.costPerUnit,
      },
      create: item,
    });
    createdIngredients[item.code] = ing;

    // Record initial stock transaction
    const existingTx = await prisma.stockTransaction.findFirst({
      where: { ingredientId: ing.id, refType: 'INITIAL' },
    });

    if (!existingTx) {
      await prisma.stockTransaction.create({
        data: {
          transactionNumber: `TX-INIT-${ing.code}`,
          ingredientId: ing.id,
          type: TransactionType.PURCHASE_IN,
          quantityIn: item.currentStock,
          quantityOut: 0,
          balanceAfter: item.currentStock,
          refType: 'INITIAL',
          note: 'ยอดยกมาเริ่มต้นระบบ JJ Mall',
          createdById: admin.id,
        },
      });
    }
  }

  console.log(`✅ ${ingredientsData.length} Ingredients seeded`);

  // 3. Create Products
  const productsData = [
    {
      code: 'PRD-MILO01',
      name: 'น้ำไมโลเย็น',
      category: 'เครื่องดื่มเย็น',
      unit: 'แก้ว',
      price: 35.00,
      cost: 12.00,
      currentStock: 0,
      minStock: 10,
    },
    {
      code: 'PRD-TEA01',
      name: 'ชาไทยเย็น',
      category: 'เครื่องดื่มเย็น',
      unit: 'แก้ว',
      price: 35.00,
      cost: 11.50,
      currentStock: 0,
      minStock: 10,
    },
    {
      code: 'PRD-COF01',
      name: 'กาแฟโบราณเย็น',
      category: 'เครื่องดื่มเย็น',
      unit: 'แก้ว',
      price: 35.00,
      cost: 11.00,
      currentStock: 0,
      minStock: 10,
    },
  ];

  for (const item of productsData) {
    const prod = await prisma.product.upsert({
      where: { code: item.code },
      update: {
        name: item.name,
        category: item.category,
        unit: item.unit,
        price: item.price,
        cost: item.cost,
      },
      create: item,
    });

    // 4. Create BOM / Recipe for น้ำไมโลเย็น
    if (prod.code === 'PRD-MILO01') {
      const existingRecipe = await prisma.recipe.findUnique({
        where: { productId: prod.id },
      });

      if (!existingRecipe) {
        await prisma.recipe.create({
          data: {
            productId: prod.id,
            description: 'สูตรน้ำไมโลเย็น 22oz สูตรมาตรฐาน JJ Mall',
            items: {
              create: [
                { ingredientId: createdIngredients['ING-MILO001'].id, quantity: 30, unit: 'กรัม' },
                { ingredientId: createdIngredients['ING-SUG001'].id, quantity: 10, unit: 'กรัม' },
                { ingredientId: createdIngredients['ING-MILK001'].id, quantity: 25, unit: 'มิลลิลิตร' },
                { ingredientId: createdIngredients['ING-CUP001'].id, quantity: 1, unit: 'ใบ' },
                { ingredientId: createdIngredients['ING-LID001'].id, quantity: 1, unit: 'ชิ้น' },
                { ingredientId: createdIngredients['ING-STR001'].id, quantity: 1, unit: 'อัน' },
              ],
            },
          },
        });
      }
    }

    // Recipe for ชาไทยเย็น
    if (prod.code === 'PRD-TEA01') {
      const existingRecipe = await prisma.recipe.findUnique({
        where: { productId: prod.id },
      });

      if (!existingRecipe) {
        await prisma.recipe.create({
          data: {
            productId: prod.id,
            description: 'สูตรชาไทยเย็น 22oz สูตรต้นตำรับ',
            items: {
              create: [
                { ingredientId: createdIngredients['ING-TEA001'].id, quantity: 25, unit: 'กรัม' },
                { ingredientId: createdIngredients['ING-SUG001'].id, quantity: 15, unit: 'กรัม' },
                { ingredientId: createdIngredients['ING-MILK001'].id, quantity: 30, unit: 'มิลลิลิตร' },
                { ingredientId: createdIngredients['ING-CUP001'].id, quantity: 1, unit: 'ใบ' },
                { ingredientId: createdIngredients['ING-LID001'].id, quantity: 1, unit: 'ชิ้น' },
                { ingredientId: createdIngredients['ING-STR001'].id, quantity: 1, unit: 'อัน' },
              ],
            },
          },
        });
      }
    }
  }

  console.log('✅ Products & Recipes seeded');
  console.log('🚀 Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
