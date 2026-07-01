const fs=require('fs');
const path='sections/footer-group.json';
const j=JSON.parse(fs.readFileSync(path,'utf8'));
const f=j.sections.footer;
f.blocks.brand_menu={type:'text',settings:{heading:'Brand',subtext:'<p><a href="/pages/about-us">About us</a><br><a href="/pages/contact">Contact us</a><br><a href="/blogs/news">Blogs</a></p>'}};
f.blocks.service_menu={type:'text',settings:{heading:'Customer Service',subtext:'<p><a href="/pages/contact">Help Center</a><br><a href="/policies/shipping-policy">Shipping Policy</a><br><a href="/policies/refund-policy">Returns & Exchanges</a></p>'}};
fs.writeFileSync(path, JSON.stringify(j,null,2));