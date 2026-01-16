const permissions = {
    admin: ["home", "RequestForPartno", "Addto_Basket", "Search_Inv", "Inv_Receipts"],
    deep: ["home", "RequestForPartno"],  //user
    inventory: ["inventory", "home","RequestForPartno","Search_Inv","Inv_Receipts","purchase","material_in_access"],
    purchase_head: ['mrf_search_access', 'mrf_review_access', 'purchase_head_mrf_search_access', 'vendors', 'vendors_creation','purchase_head_access','raise_po_request_access','review_po_request_access','safety_stock_access','purchase_access'],
    inventory_head: ["material_in_access",'safety_stock_access','inv_access'],
    purchase_employee: [],
    ceo: ['mrf_search_access', 'mrf_review_access','ceo_access'],
    quality_head: ['quality_inspection'],
    quality_employee: ['quality_inspection']
  }; 
  
  export default permissions;
  



  