import {api} from './api-client.js';

export function installBackendUI({state,refresh,render,go,toast}){
  const formIds=new Set(['auth','profile','address','password','product-edit','inventory','shipping','shop-profile','bank','category']);
  async function perform(work,target){if(target?.disabled)return;try{if(target)target.disabled=true;await work();}catch(err){toast(err.message||'Không thể kết nối máy chủ.');if(err.status===401&&!location.hash.startsWith('#/login')){await refresh();render();go('login');}}finally{if(target)target.disabled=false;}}
  document.addEventListener('submit',event=>{
    const el=event.target,id=el.getAttribute('id');if(!formIds.has(id))return;
    event.preventDefault();event.stopImmediatePropagation();const fd=new FormData(el),d=Object.fromEntries(fd),s=state();
    perform(async()=>{
      let next,notice='Đã lưu vào database.';
      if(id==='auth'){
        if(d.mode==='forgot-password'){const result=await api('/auth/forgot',{method:'POST',body:{email:d.email}});toast(result.message);return;}
        if(d.mode==='reset-password'){const raw=new URLSearchParams(location.hash.split('?')[1]||'').get('token');await api('/auth/reset',{method:'POST',body:{token:raw||'',password:d.password}});next='login';notice='Đã đổi mật khẩu. Vui lòng đăng nhập.';}
        else{await api(d.mode==='register'?'/auth/register':'/auth/login',{method:'POST',body:{email:d.email,password:d.password,name:d.name}});await refresh();next=new URLSearchParams(location.hash.split('?')[1]||'').get('next')||(s.user.role==='admin'?'admin':s.user.role==='seller'?'seller':'account');notice='Đăng nhập thành công.';}
      }else if(id==='profile'){await api('/me',{method:'PATCH',body:{name:d.name,email:d.email,phone:d.phone}});}
      else if(id==='address'){await api('/addresses'+(d.id?'/'+encodeURIComponent(d.id):''),{method:d.id?'PUT':'POST',body:{name:d.name,phone:d.phone,street:d.street}});next='addresses';}
      else if(id==='password'){if(d.password!==d.confirm)throw Error('Mật khẩu nhập lại chưa khớp.');await api('/auth/password',{method:'POST',body:{currentPassword:d.currentPassword,password:d.password}});next='login';notice='Đã đổi mật khẩu và đăng xuất mọi phiên.';}
      else if(id==='category'){await api('/admin/categories',{method:'POST',body:{name:d.name}});}
      else if(id==='bank'){const draft=s.draftApplication;if(!draft?.name)throw Error('Vui lòng nhập thông tin gian hàng trước.');await api('/applications',{method:'POST',body:{...draft,bank:d.bank+' · '+d.number}});delete s.draftApplication;next='shop-pending';}
      else if(id==='shipping'||id==='shop-profile'){await api('/seller/shops/'+s.shopId,{method:'PATCH',body:id==='shipping'?{shipping:Number(d.shipping),pickup:d.pickup}:{name:d.name,description:d.description}});}
      else if(id==='inventory'){
        const skuMap=s.products.filter(p=>p.shopId===s.shopId).flatMap(p=>p.skus);const skus=skuMap.map(x=>({id:x.id,stock:Number(d[x.id]),previousStock:x.stock}));await api('/seller/shops/'+s.shopId+'/inventory',{method:'PUT',body:{skus}});
      }else if(id==='product-edit'){
        const old=s.products.find(p=>p.id===d.id);const skus=(old?.skus||[]).map(x=>({id:x.id,label:d['label-'+x.id],code:d['code-'+x.id],price:Number(d['price-'+x.id]),stock:Number(d['stock-'+x.id]),weight:Number(d['weight-'+x.id])}));
        for(const [i,label] of (d.newVariants||'').split(',').map(x=>x.trim()).filter(Boolean).entries())skus.push({label,code:(d.newSku||'SKU-'+Date.now())+'-'+i,price:Number(d.newPrice),stock:Number(d.newStock),weight:Number(d.newWeight||350)});
        const body={name:d.name,category:d.category,description:d.description,attributes:d.attributes,brand:d.brand,version:old?.version,skus};const file=fd.get('photo');
        if(file?.size){if(!['image/png','image/jpeg'].includes(file.type)||file.size>2*1024*1024)throw Error('Chọn PNG/JPEG không quá 2 MB.');body.photo=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Không thể đọc ảnh.'));r.readAsDataURL(file);});}
        await api('/seller/shops/'+s.shopId+'/products'+(old?'/'+old.id:''),{method:old?'PUT':'POST',body});next='seller/products';notice='Đã lưu sản phẩm và gửi quản trị duyệt.';
      }
      await refresh();render();if(next)go(next);toast(notice);
    },event.submitter);
  },true);

  const actions=new Set(['role','logout','archive','moderate','approve','reject','default-address','delete-address']);
  document.addEventListener('click',event=>{
    const b=event.target.closest('[data-action]');if(!b||!actions.has(b.dataset.action))return;event.preventDefault();event.stopImmediatePropagation();const {action,id}=b.dataset,s=state();
    perform(async()=>{
      if(action==='role'){go('login');return;}
      if(action==='logout'){await api('/auth/logout',{method:'POST',body:{}});await refresh();render();go('login');return;}
      if(action==='archive')await api('/seller/shops/'+s.shopId+'/products/'+id,{method:'DELETE',body:{}});
      if(action==='moderate'){const p=s.products.find(x=>x.id===id);await api('/admin/products/'+id,{method:'PATCH',body:{moderation:p.moderation==='approved'?'rejected':'approved',reason:p.moderation==='approved'?'Quản trị tạm gỡ để rà soát nội dung.':''}});}
      if(action==='approve'||action==='reject')await api('/admin/applications/'+id,{method:'PATCH',body:{decision:action==='approve'?'approve':'reject',reason:action==='reject'?(b.closest('tr')?.querySelector('input')?.value||''):''}});
      if(action==='default-address')await api('/addresses/'+id,{method:'PATCH',body:{default:true}});
      if(action==='delete-address')await api('/addresses/'+id,{method:'DELETE',body:{}});
      await refresh();render();if(action==='archive')go('seller/products');if(action==='delete-address')go('addresses');toast('Đã cập nhật tại máy chủ.');
    },b);
  },true);
}
