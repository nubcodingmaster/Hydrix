/** Publish only a fully verified analysis snapshot; never persist GitHub credentials. */
import {execFileSync} from 'node:child_process';
const token=process.env.GITHUB_TOKEN;
if(!token)throw new Error('Missing publishing token');
const git=(args,env=process.env)=>execFileSync('git',args,{encoding:'utf8',env});
const changed=git(['diff','--name-only']).trim().split('\n').filter(Boolean);
const allowed='apps/web/public/data/analysis.json';
if(changed.some(file=>file!==allowed))throw new Error('Refusing to publish unrelated changes');
if(changed.length){
 git(['config','user.name','github-actions[bot]']);
 git(['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
 git(['add','--',allowed]);
 git(['commit','-m','data: refresh validated Gemini analysis']);
 git(['push','origin','HEAD:main'],{...process.env,GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'http.https://github.com/.extraheader',GIT_CONFIG_VALUE_0:`AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`});
 console.log('Published validated AI snapshot. Cloud Build deploys it to Jakarta.');
}else console.log('AI cache is current; no data commit or deployment needed.');
