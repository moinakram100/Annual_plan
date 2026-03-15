using GMSANNUALPLANNING_SRV from './external/GMSANNUALPLANNING_SRV.cds';

service GMSANNUALPLANNING_SRVSampleService {
    @readonly
    entity AnnualQtrpSet as projection on GMSANNUALPLANNING_SRV.AnnualQtrpSet
    {        key Material, key ValidFrom, key ValidTo, key Subinterval, key Period, Value, Createdby, Createddate, Createdtime, Changedby, Changeddate, Changedtime     }    
;
    @readonly
    entity AnnualplanSet as projection on GMSANNUALPLANNING_SRV.AnnualplanSet
    {        key Period, key Material, key SubInterval, key Customer, key ContractNo, ValidFrom, ValidTo, Acq, Aacq, Mqvalue, Uom, Status, Calendaryear, Toppercentage, UpwardFlexper, DnwardFlexper, Makegood, Makeup, Fmdeficiency, SdstartDate, SdendDate, Sddays, Sdvalue, Sdreason, Salesoffice, Createdby, Createddate, Createdtime, Changedby, Changeddate, Changedtime     }    
;
    @readonly
    entity CreateAnnualQtrSet as projection on GMSANNUALPLANNING_SRV.CreateAnnualQtrSet
    {        key ValidFrom, key ValidTo     }    
;
    @readonly
    entity CreateAnnualplanSet as projection on GMSANNUALPLANNING_SRV.CreateAnnualplanSet
    {        key Material, key Customer, key ContractNo, key ValidFrom, key ValidTo     }    
;
    @readonly
    entity xGMSxANNUAL_QT as projection on GMSANNUALPLANNING_SRV.xGMSxANNUAL_QT
    {        key Material, key ValidFrom, key ValidTo, key Subinterval, key Period, Value, Createdby, Createddate, Createdtime, Changedby, Changeddate, Changedtime     }    
;
    @readonly
    entity xGMSxAP_APPR as projection on GMSANNUALPLANNING_SRV.xGMSxAP_APPR
    {        key ContractNo, key Sapuser, key Salesoffice, key Arlevel, Remarks, Arindicator, Ardate, Artime     }    
;
    @readonly
    entity xGMSxAP_CONTRACT as projection on GMSANNUALPLANNING_SRV.xGMSxAP_CONTRACT
    {        key ContractNo, key SalesOffice, key Customer, key Material, CustomerName, ValidFrom, ValidTo, ACQ, Uom, FinancialParamDesc, ThresholdPer     }    
;
    @readonly
    entity xGMSxAP_DATA as projection on GMSANNUALPLANNING_SRV.xGMSxAP_DATA
    {        key Period, key Material, key SubInterval, key Customer, key ContractNo, ValidFrom, ValidTo, Acq, Aacq, Uom, Mqvalue, Status, Calendaryear, UpwardFlexper, DnwardFlexper, Fmdeficiency, Makegood, Makeup, Toppercentage, SdstartDate, SdendDate, Sddays, Sdvalue, Sdreason, Salesoffice, Createdby, Createddate, Createdtime, Changedby, Changeddate, Changedtime     }    
;
    @readonly
    entity xGMSxAP_MATERIAL as projection on GMSANNUALPLANNING_SRV.xGMSxAP_MATERIAL
    {        key Material, key MaterialDesc, MaterialType     }    
;
    @readonly
    entity xGMSxSALESOFFICE as projection on GMSANNUALPLANNING_SRV.xGMSxSALESOFFICE
    {        key SalesOffice     }    
;
}