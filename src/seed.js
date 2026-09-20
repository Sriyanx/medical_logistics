const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const id = () => crypto.randomUUID();

const medicines = [
  ['Paracetamol 500mg','MediCare','Paracetamol 500mg','Analgesics'], ['Ibuprofen 400mg','HealWell','Ibuprofen 400mg','Analgesics'], ['Amoxicillin 500mg','CurePlus','Amoxicillin 500mg','Antibiotics'], ['Azithromycin 500mg','MediCare','Azithromycin 500mg','Antibiotics'], ['Cetirizine 10mg','AllerFree','Cetirizine 10mg','Allergy'], ['Pantoprazole 40mg','GastroSafe','Pantoprazole 40mg','Gastrointestinal'], ['Metformin 500mg','DiaCare','Metformin Hydrochloride 500mg','Diabetes'], ['Amlodipine 5mg','CardioLife','Amlodipine 5mg','Cardiovascular'], ['Atorvastatin 10mg','CardioLife','Atorvastatin Calcium 10mg','Cardiovascular'], ['Losartan 50mg','HealWell','Losartan Potassium 50mg','Cardiovascular'], ['Omeprazole 20mg','GastroSafe','Omeprazole 20mg','Gastrointestinal'], ['Ondansetron 4mg','CurePlus','Ondansetron 4mg','Gastrointestinal'], ['Diclofenac Gel','PainEase','Diclofenac Diethylamine','Topical'], ['ORS Powder','HydraPlus','Sodium Chloride, Potassium Chloride','Supplements'], ['Vitamin D3 60000IU','VitaCore','Cholecalciferol','Supplements'], ['Vitamin B Complex','VitaCore','B-complex vitamins','Supplements'], ['Calcium + D3','BoneStrong','Calcium Carbonate, Vitamin D3','Supplements'], ['Salbutamol Inhaler','BreatheEasy','Salbutamol','Respiratory'], ['Montelukast 10mg','AllerFree','Montelukast Sodium','Respiratory'], ['Dextromethorphan Syrup','CoughCare','Dextromethorphan Hydrobromide','Respiratory'], ['Levothyroxine 50mcg','ThyroCare','Levothyroxine Sodium','Hormonal'], ['Insulin Glargine','DiaCare','Insulin Glargine','Diabetes'], ['Mupirocin Ointment','DermaHeal','Mupirocin','Dermatology'], ['Clotrimazole Cream','DermaHeal','Clotrimazole','Dermatology'], ['Ciprofloxacin 500mg','CurePlus','Ciprofloxacin','Antibiotics'], ['Folic Acid 5mg','VitaCore','Folic Acid','Supplements'], ['Domperidone 10mg','GastroSafe','Domperidone','Gastrointestinal'], ['Aceclofenac 100mg','PainEase','Aceclofenac','Analgesics'], ['Nimesulide 100mg','PainEase','Nimesulide','Analgesics'], ['Cefixime 200mg','CurePlus','Cefixime','Antibiotics']
];
function seedDemo(db) {
  const hash = bcrypt.hashSync('DemoPass123!', 10);
  db.prepare('INSERT INTO users (id,name,email,password_hash,role,phone) VALUES (?,?,?,?,?,?)').run('wholesaler-1','Apex MedSupply','admin@apexmed.example.test',hash,'WHOLESALER','+91-9000000001');
  db.prepare('INSERT INTO users (id,name,email,password_hash,role,phone) VALUES (?,?,?,?,?,?)').run('customer-1','City Care Pharmacy','citycare@example.test',hash,'CUSTOMER','+91-9000000002');
  const categories = [...new Set(medicines.map(m=>m[3]))]; categories.forEach((name, index) => db.prepare('INSERT INTO categories (id,name) VALUES (?,?)').run(`cat-${index}`,name));
  const categoryIds = Object.fromEntries(categories.map((name,index)=>[name,`cat-${index}`]));
  medicines.forEach((m,index) => {
    const productId = `product-${index+1}`; const price = 18 + index * 2; const visible = index !== 29 ? 1 : 0;
    db.prepare('INSERT INTO products (id,name,brand,composition,category_id,manufacturer,pack_size,classification,mrp,wholesale_price,gst_rate,minimum_stock,marketplace_visible,availability_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(productId,m[0],m[1],m[2],categoryIds[m[3]],index%3?'Fictional Pharma Labs':null,index%4?'10 x 10 Tablets':null,index%2?'OTC':null,price*1.25,price,12,30,visible,'AVAILABLE');
    const qty = index === 5 ? 12 : 80 + index * 7; const batchId = `batch-${index+1}`; const expiry = index === 3 ? '2026-10-15' : `2027-${String((index%10)+1).padStart(2,'0')}-28`;
    db.prepare('INSERT INTO inventory_batches (id,product_id,batch_number,expiry_date,quantity,reserved_quantity,available_quantity,purchase_price,selling_price,warehouse) VALUES (?,?,?,?,?,?,?,?,?,?)').run(batchId,productId,`APX-${1000+index}`,expiry,qty,0,qty,price*.65,price,'Main Warehouse');
    db.prepare('INSERT INTO stock_transactions (id,product_id,batch_id,type,quantity,actor_id,notes) VALUES (?,?,?,?,?,?,?)').run(id(),productId,batchId,'PURCHASE_RECEIVED',qty,'wholesaler-1','Initial demo stock');
  });
  db.prepare('INSERT INTO requirements (id,customer_id,medicine_name,composition,quantity,priority,status,notes) VALUES (?,?,?,?,?,?,?,?)').run('req-1','customer-1','Rabeprazole 20mg','Rabeprazole Sodium',100,'HIGH','REVIEWING','Required for regular patients');
}
module.exports = { seedDemo };
