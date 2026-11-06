export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money=n=>new Intl.NumberFormat('vi-VN').format(Number(n)||0)+'đ';
export const icon=(name)=>`<img class="icon" src="./assets/${name}.svg" alt="" width="18" height="18">`;
export const link=(path,text,cls='')=>`<a href="#/${path}" class="${cls}">${text}</a>`;
export const Button=({label,href,action,id='',secondary=false,type='button',extra=''})=>href!==undefined?link(href,label,`button ${secondary?'secondary':''}`):`<button type="${type}" class="button ${secondary?'secondary':''}" ${action?`data-action="${action}"`:''} ${id?`data-id="${escapeHTML(id)}"`:''} ${extra}>${label}</button>`;
export const field=(label,name,value='',type='text',required=false,extra='')=>`<label class="field"><span>${escapeHTML(label)}${required?' <small>*</small>':''}</span><input name="${name}" type="${type}" value="${escapeHTML(value)}" ${required?'required':''} ${extra}></label>`;
export const textarea=(label,name,value='',required=false)=>`<label class="field"><span>${escapeHTML(label)}</span><textarea name="${name}" rows="4" ${required?'required':''}>${escapeHTML(value)}</textarea></label>`;
export const select=(label,name,options,value='')=>`<label class="field"><span>${escapeHTML(label)}</span><select name="${name}">${options.map(x=>`<option value="${escapeHTML(typeof x==='object'?x.value:x)}" ${(typeof x==='object'?x.value:x)===value?'selected':''}>${escapeHTML(typeof x==='object'?x.label:x)}</option>`).join('')}</select></label>`;
export const checkbox=(label,name,checked=false)=>`<label class="check"><input type="checkbox" name="${name}" ${checked?'checked':''}>${label}</label>`;
export const panel=(title,body,cls='')=>`<section class="panel ${cls}">${title?`<h2>${escapeHTML(title)}</h2>`:''}${body}</section>`;
export const status=(s)=>`<span class="status ${s==='Hoàn thành'?'success':s==='Đã hủy'?'cancelled':''}">${escapeHTML(s)}</span>`;
export function table(headers,rows){return `<div class="table-wrap"><table><thead><tr>${headers.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${headers.length}" class="muted">Chưa có dữ liệu</td></tr>`}</tbody></table></div>`;}
