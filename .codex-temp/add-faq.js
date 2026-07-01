const fs=require('fs');
const path='templates/index.json';
const j=JSON.parse(fs.readFileSync(path,'utf8'));
j.sections.faq={
  type:'collapsible-content',
  blocks:{
    sizing:{type:'collapsible_row',settings:{heading:'How do I find my size?',icon:'ruler',row_content:'<p>Use this editable FAQ row to explain sizing, measuring and fit guidance for your nail sets.</p>',page:''}},
    lasting:{type:'collapsible_row',settings:{heading:'How long do press-on nails last?',icon:'heart',row_content:'<p>Explain expected wear time, application prep and care tips based on your products.</p>',page:''}},
    reusable:{type:'collapsible_row',settings:{heading:'Are the nails reusable?',icon:'recycle',row_content:'<p>Describe removal, cleaning and storage recommendations here.</p>',page:''}},
    shipping:{type:'collapsible_row',settings:{heading:'Where do you ship?',icon:'truck',row_content:'<p>Summarize shipping regions, thresholds and processing times, or link to a policy page.</p>',page:''}}
  },
  block_order:['sizing','lasting','reusable','shipping'],
  settings:{caption:'Need help?',heading:'FAQs',heading_size:'h1',heading_alignment:'center',layout:'none',color_scheme:'scheme-1',container_color_scheme:'scheme-1',open_first_collapsible_row:false,image_ratio:'adapt',desktop_layout:'image_second',padding_top:52,padding_bottom:52}
};
const order=j.order.filter(k=>k!=='faq');
const insertBefore=order.indexOf('newsletter');
if(insertBefore>=0) order.splice(insertBefore,0,'faq'); else order.push('faq');
j.order=order;
fs.writeFileSync(path, JSON.stringify(j,null,2));