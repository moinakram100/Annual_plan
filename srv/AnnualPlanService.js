const cds = require('@sap/cds');

module.exports = async (srv) => 
{        
    // Using CDS API      
    const GMSANNUALPLANNING_SRV = await cds.connect.to("GMSANNUALPLANNING_SRV"); 
      srv.on('READ', 'AnnualQtrpSet', req => GMSANNUALPLANNING_SRV.run(req.query)); 
      srv.on('READ', 'CreateAnnualQtrSet', req => GMSANNUALPLANNING_SRV.run(req.query)); 
      srv.on('CREATE', 'CreateAnnualQtrSet', req => GMSANNUALPLANNING_SRV.run(req.query)); 
      srv.on('CREATE', 'AnnualQtrpSet', req => GMSANNUALPLANNING_SRV.run(req.query));
      srv.on('READ', 'xGMSxAP_MATERIAL', req => GMSANNUALPLANNING_SRV.run(req.query));
      srv.on('READ', 'xGMSxANNUAL_QT', req => GMSANNUALPLANNING_SRV.run(req.query)); 
      srv.on('READ', 'xGMSxAP_CONTRACT', req => GMSANNUALPLANNING_SRV.run(req.query)); 
      srv.on('CREATE', 'CreateAnnualplanSet', req => GMSANNUALPLANNING_SRV.run(req.query)); 
      srv.on('CREATE', 'AnnualplanSet', req => GMSANNUALPLANNING_SRV.run(req.query)); 
      srv.on('READ', 'xGMSxAP_DATA', req => GMSANNUALPLANNING_SRV.run(req.query)); 
      srv.on('READ', 'xGMSxAP_APPR', req => GMSANNUALPLANNING_SRV.run(req.query)); 
      srv.on('CREATE', 'xGMSxAP_APPR', req => GMSANNUALPLANNING_SRV.run(req.query)); 
      srv.on('READ', 'xGMSxSALESOFFICE', req => GMSANNUALPLANNING_SRV.run(req.query)); 


       srv.on('getDistinctCustomers', async (req) => {

        const extSrv = await cds.connect.to('GMSANNUALPLANNING_SRV');

        const data = await extSrv.run(
          SELECT.from('xGMSxAP_CONTRACT')
            .columns('Customer', 'CustomerName')
        );

        const map = new Map();
        data.forEach(item => {
          map.set(item.Customer, item);
        });

        const result = Array.from(map.values());

        result.sort((a, b) => a.Customer.localeCompare(b.Customer));

        return result;

      });

  
}