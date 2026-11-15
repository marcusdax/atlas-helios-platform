const {Client}=require('pg');
const c=new Client({host:'127.0.0.1',port:5432,database:'atlas_helios',user:'postgres',password:'postgres'});
c.connect().then(()=>c.query(`SELECT current_database(), count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')`)).then(r=>{console.log('DB OK:',r.rows);c.end()}).catch(e=>console.error('FAIL:',e.message));
