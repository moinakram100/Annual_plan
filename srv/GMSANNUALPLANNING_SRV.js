const cds = require('@sap/cds');

module.exports = async (srv) => 
{        
    // Using CDS API      
    const GMSANNUALPLANNING_SRV = await cds.connect.to("GMSANNUALPLANNING_SRV"); 
      srv.on('READ', 'AnnualQtrpSet', req => GMSANNUALPLANNING_SRV.run(req.query)); 
      srv.on('READ', 'AnnualplanSet', req => GMSANNUALPLANNING_SRV.run(req.query)); 
      srv.on('READ', 'CreateAnnualQtrSet', req => GMSANNUALPLANNING_SRV.run(req.query)); 
      srv.on('READ', 'CreateAnnualplanSet', req => GMSANNUALPLANNING_SRV.run(req.query)); 
      srv.on('READ', 'xGMSxANNUAL_QT', req => GMSANNUALPLANNING_SRV.run(req.query)); 
      srv.on('READ', 'xGMSxAP_APPR', req => GMSANNUALPLANNING_SRV.run(req.query)); 
      srv.on('READ', 'xGMSxAP_CONTRACT', req => GMSANNUALPLANNING_SRV.run(req.query)); 
      srv.on('READ', 'xGMSxAP_DATA', req => GMSANNUALPLANNING_SRV.run(req.query)); 
      srv.on('READ', 'xGMSxAP_MATERIAL', req => GMSANNUALPLANNING_SRV.run(req.query)); 
      srv.on('READ', 'xGMSxSALESOFFICE', req => GMSANNUALPLANNING_SRV.run(req.query)); 
}