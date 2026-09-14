/** Synthetic fixtures for the explicitly isolated local Supabase, never production. */
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
async function main() {
  if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: full-qa-seed.cjs isolated.env output.json');
  const env = Object.fromEntries(fs.readFileSync(process.argv[2], 'utf8').split(/\r?\n/).flatMap(line => {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/); return m ? [[m[1], m[2].replace(/^["']|["']$/g, '')]] : [];
  }));
  if (env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:54321' || env.HACHI_QA_ISOLATED !== 'true') {
    throw new Error('Requires explicitly marked local QA backend http://127.0.0.1:54321');
  }
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
  const run = 'qa-' + Date.now();
  const password = 'Local-Hachi-QA-2026!'; // Synthetic, local-only credentials.
  const fixture = {run, backend:env.NEXT_PUBLIC_SUPABASE_URL, users:[], companies:[], records:{}};
  async function insert(table, value) {
    const {data,error} = await admin.from(table).insert(value).select().single();
    if(error)throw new Error(table + ': ' + error.message); return data;
  }
  for (const suffix of ['a','b']) {
    fixture.companies.push(await insert('companies',{id:randomUUID(), name:'QA検証専用会社' + suffix.toUpperCase(),slug:run+'-'+suffix,settings:{}}));
  }
  const roles = ['hq_admin','admin','executive','sales','field_manager','designer','administration','employee','contractor_admin','external_partner'];
  const specifications = roles.map(role=>({email:run+'-'+role+'@example.test',role,company:0}));
  specifications.push({email:run+'-other@example.test',role:'hq_admin',company:1});
  specifications.push({email:'super-admin@example.com',role:'hq_admin',company:0});
  const listed=await admin.auth.admin.listUsers({perPage:1000});
  if(listed.error)throw listed.error;
  for(const spec of specifications){
    let user=listed.data.users.find(u=>u.email===spec.email);
    if(!user){
      const made=await admin.auth.admin.createUser({email:spec.email,password,email_confirm:true});
      if(made.error)throw made.error;user=made.data.user;
    }
    const profile={id:user.id,company_id:fixture.companies[spec.company].id,email:spec.email,role:spec.role,display_name:'QA '+(spec.company?'別会社 ': '')+spec.role};
    const saved=await admin.from('profiles').upsert(profile);if(saved.error)throw saved.error;
    fixture.users.push({...profile,password});
  }
  const owner=fixture.users[0],company_id=owner.company_id;
  const customer=await insert('customers',{company_id,name:'QA 山田太郎',company_name:'QA 検証商事',customer_type:'individual',email:'customer@example.test',status:'active',assigned_to:owner.id});
  const otherCustomer=await insert('customers',{company_id:fixture.companies[1].id,name:'QA 他社限定顧客',status:'active'});
  const deal=await insert('deals',{company_id,customer_id:customer.id,title:'QA 新築工事',stage:'negotiation',value:1100000,assigned_to:owner.id});
  const estimate=await insert('estimates',{company_id,customer_id:customer.id,deal_id:deal.id,estimate_no:run+'-EST',title:'QA 新築工事見積',status:'draft',subtotal:1000000,tax:100000,total:1100000,cost_total:600000,gross_profit:400000,gross_profit_rate:40,assigned_to:owner.id});
  const category=await insert('estimate_categories',{company_id,estimate_id:estimate.id,name:'QA 建築工事',sort_order:0});
  await insert('estimate_items',{company_id,estimate_id:estimate.id,category_id:category.id,name:'QA 工事項目',quantity:1,unit:'式',cost_price:600000,cost_amount:600000,selling_price:1000000,selling_amount:1000000,sort_order:0});
  const contract=await insert('contracts',{company_id,customer_id:customer.id,deal_id:deal.id,estimate_id:estimate.id,contract_no:run+'-CON',title:'QA 新築工事契約',amount:1100000,status:'preparing',assigned_to:owner.id});
  const construction=await insert('constructions',{company_id,customer_id:customer.id,deal_id:deal.id,estimate_id:estimate.id,contract_id:contract.id,construction_no:run+'-CST',title:'QA 新築工事現場',order_amount:1100000,budget_cost:600000,status:'preparing',assigned_to:owner.id});
  const craftsman=await insert('craftsmen',{company_id,name:'QA 職人',company_name:'QA 建設',specialty:'carpenter',email:'craftsman@example.test'});
  const invoice=await insert('invoices',{company_id,customer_id:customer.id,construction_id:construction.id,invoice_no:run+'-INV',recipient:'QA 検証商事',invoice_date:'2026-09-15',due_date:'2026-10-31',subtotal:100000,tax:10000,total:110000,status:'draft',created_by:owner.id});
  await insert('invoice_items',{company_id,invoice_id:invoice.id,description:'QA 着手金',quantity:1,unit_price:100000,amount:100000,sort_order:0});
  fixture.records={customer,otherCustomer,deal,estimate,contract,construction,craftsman,invoice};
  const output=path.resolve(process.argv[3]);fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(fixture,null,2),{mode:0o600});
  console.log(JSON.stringify({run,companies:fixture.companies.length,users:fixture.users.length,fixtureFile:output}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
