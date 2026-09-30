import { SIAN_INSTRUCTIONS } from './sian-instructions.js';
import { SIAN_INVENTORY } from './sian-inventory.js';
import { SIAN_BUILD } from './sian-build-steps.js';

export const BLUEPRINT_ID='lego-42115-official-v1';
const titles=['Gearbox & rear suspension','Engine & front suspension','Interior details & seats','Rear spoiler','Scissor doors','Rims & tires'];
const ranges=[[1,181],[182,382],[383,580],[581,857],[858,1068],[1069,1084]];
export const CHAPTERS=ranges.map(([first,last],index)=>({id:index,title:titles[index],description:`Box ${index+1} · Steps ${first}–${last} · ${last<=500?'Book 1':first>500?'Book 2':'Books 1 & 2'}`,start:first-1,end:last,color:['#899547','#bfd15d','#708444','#adc347','#baca59','#273725'][index]}));

export function createSianModel(){
  const mapped=new Map(SIAN_BUILD.steps.map(step=>[step.id,step]));
  const steps=SIAN_INSTRUCTIONS.steps.map((step,index)=>{
    const assembly=mapped.get(step.id);
    if(!assembly)throw new Error(`Missing Sián assembly step ${step.id}.`);
    return {...step,...assembly,index,chapter:CHAPTERS.find(chapter=>index>=chapter.start&&index<chapter.end).id};
  });
  return {id:BLUEPRINT_ID,blueprintId:BLUEPRINT_ID,kind:'official',buildMode:'instructions',
    title:'Lamborghini Sián FKP 37',shortTitle:'Lamborghini Sián',setNumber:'42115',year:2020,edition:'Technic · 1:8 scale',
    tagline:'An icon of engineering. One piece at a time.',displayHeading:'Every detail, assembled.',
    description:'Build up the Lamborghini Sián, from the internal Technic structure to its lime bodywork and gold wheels.',
    galleryEyebrow:'LEGO TECHNIC · 2020',galleryDescription:'Lime bodywork. Gold wheels. Build the Sián from the inside out.',
    defaultDescription:'My Lamborghini Sián FKP 37, assembled step by step from both LEGO instruction books.',
    pieceCount:3696,progressTotal:steps.length,progressUnit:'steps',costPolicy:'unestimated',bricks:[],
    inventory:SIAN_INVENTORY,steps,assembly:SIAN_BUILD,
    thumbnail:'/official/42115/gallery-preview-v2.png',modelUrl:'/official/42115/model.mpd',
    sceneConfig:{assetRoot:'/official/42115',lineOpacity:.10,instancesUrl:'/official/42115/instances.json'},
    source:{...SIAN_INSTRUCTIONS,steps:undefined,setUrl:'https://www.lego.com/en-ca/product/lamborghini-sian-fkp-37-42115'},
    galleryLabel:'Official LEGO set',
    details:{
      instructionNote:'Both supplied booklets form one continuous build: 1,084 numbered steps across six boxes. Book 1 contains steps 1–500; Book 2 continues with 501–1,084.',
      inventoryNote:'The printed inventory lists 3,696 pieces across 294 LEGO element IDs, matching the published set count.',
      modelNote:'The CAD model is a community reconstruction by Jens Brühl (jb70), licensed under CC BY 2.0. Step quantities follow the LEGO booklets. Positions of repeated identical pieces are reconstructed from the CAD assembly order; some printed graphics are omitted.',
      scopeNote:'This is a digital assembly prototype. It does not simulate the drivetrain, clutch strength or structural loads. Consult the original booklets when building the physical set.',
      attribution:'Instruction artwork © The LEGO Group. Lamborghini marks belong to Automobili Lamborghini S.p.A. Independent prototype, without LEGO or Lamborghini endorsement.',
    },
  };
}
