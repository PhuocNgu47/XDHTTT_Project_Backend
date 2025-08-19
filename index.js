const express=require('express');
const cors=require('cors');
const fs=require('fs').promises;
const path=require('path');
const jwt=require('jsonwebtoken');
const bcrypt=require('bcryptjs');
require('dotenv').config();

const app=express();
app.use(cors());
app.use(express.json());

const DB_PATH=path.join(__dirname,'db.json');
async function readDb(){
  try{const d=await fs.readFile(DB_PATH,'utf8');return JSON.parse(d||'{}')}catch(e){return {users:[],products:[],orders:[]}}
}
async function writeDb(db){await fs.writeFile(DB_PATH,JSON.stringify(db,null,2),'utf8')}

function signToken(u){
  return jwt.sign({id:u.id,role:(u.role||'user').toLowerCase(),email:u.email,name:u.name},process.env.JWT_SECRET||'devsecret',{expiresIn:'7d'})
}

async function auth(req,res,next){
  const a=req.headers.authorization||'';
  const t=a.startsWith('Bearer ')?a.slice(7):null;
  if(!t) return res.status(401).json({error:'No token'});
  try{req.user=jwt.verify(t,process.env.JWT_SECRET||'devsecret');next()}catch(e){return res.status(401).json({error:'Invalid token'})}
}

function requireRole(...roles){
  return (req,res,next)=>{
    if(!req.user) return res.status(401).json({error:'No auth'});
    if(!roles.map(r=>String(r).toLowerCase()).includes(String(req.user.role).toLowerCase())){
      return res.status(403).json({error:'Forbidden'});
    }
    next();
  }
}

app.get('/',(req,res)=>res.json({ok:true}));

app.post('/login',async (req,res)=>{
  const {email,password}=req.body||{};
  const db=await readDb();
  const u=db.users.find(x=>(x.email||'').toLowerCase()===(email||'').toLowerCase());
  if(!u) return res.status(401).json({error:'Email hoặc mật khẩu không đúng'});
  const ok=u.password?.startsWith('$2')?await bcrypt.compare(password,u.password):u.password===password;
  if(!ok) return res.status(401).json({error:'Email hoặc mật khẩu không đúng'});
  const token=signToken(u);
  return res.json({user:{id:u.id,name:u.name,email:u.email,role:(u.role||'user').toLowerCase()},token});
});

app.post('/register',async (req,res)=>{
  const {name,email,password,role='user'}=req.body||{};
  if(!email||!password||!name) return res.status(400).json({error:'Thiếu dữ liệu'});
  const db=await readDb();
  if(db.users.find(x=>(x.email||'').toLowerCase()===(email||'').toLowerCase())) return res.status(409).json({error:'Email đã tồn tại'});
  const hashed=await bcrypt.hash(password,10);
  const id=db.users.length?Math.max(...db.users.map(x=>x.id))+1:1;
  const u={id,name,email,password:hashed,role:String(role).toLowerCase()};
  db.users.push(u);
  await writeDb(db);
  const token=signToken(u);
  return res.status(201).json({user:{id,name,email,role:u.role},token});
});

app.get('/profile',auth,async (req,res)=>{
  const db=await readDb();
  const u=db.users.find(x=>x.id===req.user.id);
  if(!u) return res.status(404).json({error:'Không tìm thấy người dùng'});
  return res.json({user:{id:u.id,name:u.name,email:u.email,role:(u.role||'user').toLowerCase()}});
});

// Admin only: users list
app.get('/users',auth,requireRole('admin'),async (req,res)=>{
  const db=await readDb();
  return res.json(db.users.map(u=>({id:u.id,name:u.name,email:u.email,role:(u.role||'user').toLowerCase()})));
});

app.get('/products',async (req,res)=>{
  const db=await readDb();
  return res.json(db.products);
});

app.get('/orders',auth,async (req,res)=>{
  const db=await readDb();
  return res.json(db.orders||[]);
});

app.put('/products/:id',auth,async (req,res)=>{
  const db=await readDb();
  const id=Number(req.params.id);
  const idx=db.products.findIndex(p=>p.id===id);
  if(idx<0) return res.status(404).json({error:'Not found'});
  db.products[idx]={...db.products[idx],...req.body};
  await writeDb(db);
  return res.json(db.products[idx]);
});

app.patch('/orders/:id',auth,async (req,res)=>{
  const db=await readDb();
  const id=Number(req.params.id);
  const idx=(db.orders||[]).findIndex(o=>o.id===id);
  if(idx<0) return res.status(404).json({error:'Not found'});
  db.orders[idx]={...db.orders[idx],...req.body};
  await writeDb(db);
  return res.json(db.orders[idx]);
});

const PORT=process.env.PORT||3002;
app.listen(PORT,()=>console.log('API listening on http://localhost:'+PORT));
