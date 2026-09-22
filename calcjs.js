var varCleanDirty;

$( document ).ready(function() { 
	
	
	jQuery.extend( jQuery.fn.dataTableExt.oSort, {
		"date-uk-pre": function ( a ) {
		    var ukDatea = a.split('/');
		    return (ukDatea[2] + ukDatea[1] + ukDatea[0]) * 1;
		},

		"date-uk-asc": function ( a, b ) {
		    return ((a < b) ? -1 : ((a > b) ? 1 : 0));
		},

		"date-uk-desc": function ( a, b ) {
		    return ((a < b) ? 1 : ((a > b) ? -1 : 0));
		}		

	} );
	
	 $('[data-toggle="tab"]').on('show.bs.tab', function (e) {
		 if(!tickerSeleccionado()){
			 $('#selecTicker').focus();
			e.preventDefault();
		 }
	 });	
	
	varCleanDirty = null;
	
	cargarTickers(); 
	cargaInicial(1);
		   
   $("#selecTicker").change(function(){
        cargarDatosBono(this.value);
        $('#buscarBono').val('');
    	limpiarBusquedaBono();
    });
       
   $("#fechaLiqinp").blur(function(){	   
	     obteneFlujosIndicadoresProxCupon('s','s','s','y');
		 actualizarTirSpread();
   });
   
   $("#fechaLiqinp").keyup(function(event){
	   var key = event.which;		 
		if (key == 13){
			$("#fechaLiqinp").blur();
		}
   });
   
   $('#fechainp').change(function(){
	   var plazo = $('#fechainp').val();
		
		if(plazo != 'MANUAL' ){
			$('#fechaLiqinp').attr('readonly', true);		
			obtenerFechaPlazo();
			obteneFlujosIndicadoresProxCupon('s','s','s',plazo);
			actualizarTirSpread();
		} else {
			$('#fechaLiqinp').attr('readonly', false);
		}
   });
         
   $('#fechaHoyinp').blur(function(){
	   obtenerFechaPlazo();
	   obteneFlujosIndicadoresProxCupon('s','s','s','y');
	   actualizarTirSpread();
   });
   
   $('#fechaHoyinp').keyup(function(event){
		var key = event.which;		 
		if (key == 13){
			$("#fechaHoyinp").blur(); 
		}
   });
      	
	  $('#PrecioInp').change(function(){
		   obteneFlujosIndicadoresProxCupon('n','s','n','x');		
	   });
	  
	  $('#DolarFutInp').change(function(){
		   obteneFlujosIndicadoresProxCupon('s','s','s','x');			   
	   });
	  
	  $('#TipoCambioInp').change(function(){
		  if((    $('#tipoMonedaSel').val() == 'Pesos'  && $('#monedaPrecioTirLab').text() != 'Precio en AR$:') || 
				 ($('#tipoMonedaSel').val() != 'Pesos' && $('#monedaPrecioTirLab').text() == 'Precio en AR$:')  ){
			  obteneFlujosIndicadoresProxCupon('n','s','n','x');  
		  }		  
		  
		  calcularPrecioConCambio();
		 // actualizarValuacionCartera();
	   });
	  
	  $('#tipoMonedaSel').change(function(){
		  cambioTipoMoneda(); 
		   obteneFlujosIndicadoresProxCupon('n','s','n','x');
		  // actualizarValuacionCartera();
	   });
	  	  
	   $('#tipoPrecioSel').change(function(){
		  obteneFlujosIndicadoresProxCupon('n','s','n','x');
		  cambiarLabelCleanDirty();
		 // actualizarValuacionCartera();
	   });
	  
	   
	   $('#cantidadNomInp').change(function(){
		   if ($(this).val() == null || $(this).val() == ''){
				  $(this).val('1');			
			}	
			cambioNominales();	    
		});
	  

	  $('#tirReqInp').change(function(){
		  actualizarTirSpreadReq(this.value);
	  });
	  	  
	  $('#spreadTrimReqInp').change(function(){
		  actualizarSpreadTrimReq(this.value);
	  });	  
	  
	  $('#tasaVarSel').change(function(){
		  cambioSelectTasa(this.value);
	  });
	  
	  $('#badlarProxCupLab').change(function(){
		  obteneFlujosIndicadoresProxCupon('s','s','s','x');
		  actualizarTirSpread();			 
	  });
		 
	  $('#badlarRestCupLab').change(function(){
		  obteneFlujosIndicadoresProxCupon('s','s','s','x');
		  actualizarTirSpread();
	  });
	  
	  $('#buscarBono').change(function(){
		   buscarBono();
	   });
	  
		  
	  $('#selecBonoDesc').click(function(){
		// descripcion que se muestra en el select var text= $("#selecBonoDesc option:selected").text();
		
		  var dato = $("#selecBonoDesc option:selected").val();	
		  var ticker = $("#selecTicker").val();		  
		  if (dato != '' && dato != 'Resultado de Búsqueda' && dato != 'Haga Click para ver resultados de busqueda' && dato != ticker){
			  cargarDatosBono(dato);		 
			  $('#selecTicker option:contains("'+dato+'")').attr('selected', 'selected');
			  //$('#selecTicker').val(dato);
		  }
	  });
	  	  
	  $('.numeric').keydown(function(event){
		  var key = event.which;
		  if((key<48 || key>57) && (key<96 || key>105)  && (key != 110 && key != 188 && key != 190) && key != 8 && key != 13 && key != 46 && key != 37 && key != 39){
			  event.preventDefault();			   
		  } else {			 
			 if(key == 110 || key == 188 || key == 190){
				  if (this.value.includes('.')){
					  event.preventDefault();
				  }
			 }			  
		  }		  
	  });
	  
	  
	  $('.numeric').keyup(function(event){
		  var key = event.which;		 
			  if (key == 188){
				  var n = this.value.replace(',','.');
				  if(this.value != n){
					  this.value = n;
				  }				
			  }			  
			  var a = solodosDecimales(this.value);
			  $(this).val(a);			  
	  });
	  
	  
	  $('.numeric4').keydown(function(event){
		  var key = event.which;
		  if((key<48 || key>57) && (key<96 || key>105)  && (key != 110 && key != 188 && key != 190) && key != 8 && key != 13 && key != 46 && key != 37 && key != 39){
			  event.preventDefault();			   
		  } else {			 
			 if(key == 110 || key == 188 || key == 190){
				  if (this.value.includes('.')){
					  event.preventDefault();
				  }
			 }			  
		  }		  
	  });
	  
	  
	  $('.numeric4').keyup(function(event){
		  var key = event.which;		 
			  if (key == 188){
				  var n = this.value.replace(',','.');
				  if(this.value != n){
					  this.value = n;
				  }				
			  }			  
			  var a = soloSeisDecimales(this.value);
			  $(this).val(a);			  
	  });
	  
	  $('.numericNeg').keydown(function(event){
		  var key = event.which;
		  if((key<48 || key>57) && (key<96 || key>105)  && (key != 110 && key != 188 && key != 190) && key != 8 && key != 13 && key != 46 && key != 37 && key != 39 && key != 109 && key != 189){
			  event.preventDefault();			   
		  } else {			 
			 if(key == 110 || key == 188 || key == 190){
				  if (this.value.includes('.')){
					  event.preventDefault();
				  }
			 }			  
		  }		  
	  });
	  	  
	 $('.numericNeg').keyup(function(event){
		  var key = event.which;		 
			  if (key == 188){
				  var n = this.value.replace(',','.');
				  if(this.value != n){
					  this.value = n;
				  }				
			  }			  
			  var a = solodosDecimales(this.value);
			  $(this).val(a);			  
	 });
	 	
	 $('#body').find('input[type=text]').change(function(){
			this.blur();
	 });
		 
	 $('#nav-sensibilidad-tab').click(function(e){
		 cargarSensibilidad();		 
	 });
	  
	 $('#nav-mercado-tab').click(function(){
		 cargarAnalisisMercado();
	 });	 
	 
	 $('#nav-condEm-tab').click(function(){
		 cargarProspecto();
	 });
	 
	 $('#nav-avisospag-tab').click(function(){
		 cargarAvisos();
	 });
		 
		 
	$('#variacionPrecioInp').change(function(){
		 sensibilidadPrecio();
	});

	$('#variacionCambioInp').change(function(){ 
		 sensibilidadTipoCambio();
	});
	 
	$('#variacionTirInp').change(function(){ 
		 sensibilidadTirSpread();
	});
	 
	$('.columnaTasaVar').hide();	
	$('#pagaEnRow').hide();
	
	$("#compartirbtn").click(function(e){
		e.preventDefault(); 
		compartirBono();		
	});
		
});

function tickerSeleccionado(){
	var ticker = $('#selecTicker').val();
	if (ticker != null && ticker != '') {	
		return true;
	} else {
		return false;
	}
}


function compartirBono(){
	
	var ticker = $('#selecTicker').val();
	
	if (ticker != null && ticker != '') {	
		$.get("/calculadoraDeBonos/compartir/"+ticker, null ,function(data, status){
			data = $.parseJSON(JSON.stringify(data));	
			var valida = validarAutorizacion(data);
			if(valida == 'ok') {
				$.alert({
				    title: 'Compartir ' + ticker,
				    content: 'Usuario: ' + data.datos[0]['usuario'] + '\nClave: ' +  data.datos[0]['pass']
				});
			}
		});
	} else {
		$.alert({
			 title: '',
		    content: 'Seleccione ticker de bono a compartir'
		});
	}
	$('#selecTicker').focus();
};


function validarSeleccionoConsulta(){
	var tfcon  = Cookies.get("tickcons");

	if (tfcon != null){
		 Cookies.remove('tickcons');
	 		
		 $('#selecTicker').val(tfcon);
		 cargarDatosBono(tfcon);		
	}
	
}


function cargarAnalisisMercado(){
	var ticker = $('#selecTicker').val();
	var fechaLiquidacion =  $('#fechaLiqinp').val();
	var precio =  getPrecio();
	
	var vaciarTabla = false;
	
	if (ticker != null && ticker != '' && fechaLiquidacion != null && precio > 0) {	
		
		var tipoCambio = getTipoCambio();	
		var moneda = $('#tipoMonedaSel').val();
		var tipoPrecio = $('#tipoPrecioSel').val();
		
		var proxCup = getTasaProxCup();
		var restCup = getTasaRestCup();
		
		$.get("/calculadoraDeBonos/analisisMercado/"+ticker+"/"+fechaLiquidacion+"/"+precio+"/"+tipoPrecio+"/"+tipoCambio+"/"+proxCup+"/"+restCup+"/"+moneda , null, function(data, status){
			data = $.parseJSON(JSON.stringify(data));
			var valida = validarAutorizacion(data);
			if(valida == 'ok') {
							
				if($('#tablaBonosSimilares').html() != ''){
					var table = $('#tablaBonosSimilares').DataTable();
					table.destroy();			    
					$('#tablaBonosSimilares').empty(); 
				}
								
												
				var tipoBono = null;
				try{			
					tipoBono = data.bonosSimilares[0]['tipobono'];
				} catch {}
				
				var optionTable;
				
				if (tipoBono != null) {	
					
					var datosle = [];
					var datosle2 = [];					
					if (tipoBono == 'L'  || tipoBono == 'D' || tipoBono == 'E'){
						
						var dataSet = [];
						
						for(i=0;i<data.bonosSimilares.length;i++){
							var monedaM = data.bonosSimilares[i]['tipomoneda'];
							var monedaMDescripcion ;
							if(monedaM == '1'){
								monedaMDescripcion = 'Pesos';
							} else if(monedaM == '2'){
								monedaMDescripcion = 'Dolares';
							} else if(monedaM == '3'){
								monedaMDescripcion = 'Euros';
							} else if(monedaM == '4'){
								monedaMDescripcion = 'UVAs';
							}  else if(monedaM == '14'){
								monedaMDescripcion = 'Pesos Chilenos';
							}
							var vtna = dosDecimales(data.bonosSimilares[i]['tna']);
							var vdurationm = dosDecimales(data.bonosSimilares[i]['durationmodificada']);
							var tipoCupon = data.bonosSimilares[i]['tipocupp'];
							
							var codigoEsp = data.bonosSimilares[i]['codigoespecie'];	
							var vDiasR = data.bonosSimilares[i]['diasrestantes'];
							
							datosle.push([Number(vDiasR), Number(vtna)]);
							datosle2.push({
					            name: codigoEsp,
					            y: Number(vtna),
					            x: Number(vDiasR)
					        });
							
							var datt = ['<label data-toggle="tooltip" title="'+data.bonosSimilares[i]['descripcion']+'">'+codigoEsp+'</label>', fechaFormateada(new Date(data.bonosSimilares[i]['fechavencimiento'].replace(/[#-]/g, "/"))), monedaMDescripcion, separadorMiles(dosDecimales(data.bonosSimilares[i]['precio'])), vDiasR, separadorMiles(vtna) + ' %'];											
							dataSet.push(datt);					
						}
						var datosle3 = [];
						
						var valorY = $('#TnaMercadoBDLab').text().replace(' %' , '');
						
						var datosle3 = [{
				            name: $('#tickerMercadoBDLab').text(),
				            y: Number(valorY),
				            x: Number($('#diasRestantesMercadoBDLab').text())
				        }];
						
						datosle.push([ Number($('#diasRestantesMercadoBDLab').text()), Number(valorY)]);
						
						var desTipoBono;
						if(tipoBono == 'L' ){
							desTipoBono = 'LECAPs';
						} else if(tipoBono == 'D' ){
							desTipoBono = 'LETEs';
						} else if(tipoBono == 'E'){
							desTipoBono = 'LECERs';
						};
						
						graficarCompararBonos(datosle, datosle2, datosle3, desTipoBono,'TNA');
												
						optionTable =  {
						        data: dataSet,
								"autoWidth": false, 
						        cache: false,
						        bDestroy: true,
						        "oLanguage": {
						        	"oPaginate": {					        	
						        	"sPrevious": "<",
						        	"sNext": ">",				        	
						        	},
						 			"sInfo": " _START_ - _END_ de _TOTAL_ items",
						 			"sEmptyTable": "No se encontraron datos"
						        },					         
						        "bFilter": false,
						        "bLengthChange": false,
						        "iDisplayLength": 20,						        
						        columns: [{ title: "Ticker", "width": "17%", "targets": 0},
								            { title: "Vencimiento", "width": "17%", "targets": 0,  "sType": "date-uk" },
								            { title: "Moneda", "width": "17%", "targets": 0 },
								            { title: "Precio" ,"width": "16%", "targets": 0 },
								            { title: "Dias Restantes", "width": "16%", "targets": 0 },
								            { title: "TNA", "width": "17%", "targets": 0 }
								        ]
						    } ;						 
						 
						
					} else {
						var dataSet = [];
						var sppa;
						for(i=0;i<data.bonosSimilares.length;i++){
							var monedaM = data.bonosSimilares[i]['tipomoneda'];
							var monedaMDescripcion ;
							if(monedaM == '1'){
								monedaMDescripcion = 'Pesos';
							} else if(monedaM == '2'){
								monedaMDescripcion = 'Dolares';
							} else if(monedaM == '3'){
								monedaMDescripcion = 'Euros';
							} else if(monedaM == '4'){
								monedaMDescripcion = 'UVAs';
							} else if(monedaM == '14'){
								monedaMDescripcion = 'Pesos Chilenos';
							}
							
							var spp;
							var vtir = dosDecimales(data.bonosSimilares[i]['tir']);
							var vdurationm = dosDecimales(data.bonosSimilares[i]['durationmodificada']);
							var tipoCupon = data.bonosSimilares[i]['tipocupp'];
							var codigoEsp = data.bonosSimilares[i]['codigoespecie'];							
							
							if(tipoCupon == 'B' ||  tipoCupon == 'T' || tipoCupon == 'P' || tipoCupon == 'L' || tipoCupon == 'G' ){
								spp = dosDecimales(data.bonosSimilares[i]['spreadmercado']);
								
								datosle.push([Number(vdurationm), Number(spp)]);
								datosle2.push({
						            name: codigoEsp,
						            y: Number(spp),
						            x: Number(vdurationm)
						        });
								
								spp = separadorMiles(spp) + ' %';	
								sppa='Spread/Mercado';
							} else {
								spp =  '-';
								
								datosle.push([Number(vdurationm), Number(vtir)]);
								datosle2.push({
						            name: codigoEsp,
						            y: Number(vtir),
						            x: Number(vdurationm)
						        });
								sppa='YTM (anual)';
							}					
							
							var frecu = data.bonosSimilares[i]['frecuencia'];
							
							var frecuTabla;
							
							if(frecu== '4' ){
								frecuTabla = 'Trimestral';
							} else if (frecu == '2'  ){
								frecuTabla =  'Semestral';			
							} else if (frecu == '6'  ){
								frecuTabla =  'Bimestral';			
							}						
							else if (frecu == '12' ){
										
								 if (tipoBono=='L' || tipoBono=='E' ){
									 frecuTabla =  'Bullet';	
								 } else{
									 frecuTabla =  'Mensual';	
								 }
							}
							var datt = ['<label data-toggle="tooltip" title="'+data.bonosSimilares[i]['descripcion']+'">'+codigoEsp+'</label>', separadorMiles(dosDecimales(data.bonosSimilares[i]['precio'])), data.bonosSimilares[i]['cupproxx'], separadorMiles(vtir), separadorMiles(dosDecimales(data.bonosSimilares[i]['tasanominal'])), spp, separadorMiles(vdurationm), fechaFormateada(new Date(data.bonosSimilares[i]['fechavencimiento'].replace(/[#-]/g, "/"))), frecuTabla];											
							dataSet.push(datt);								
						}
						var datosle3 = [];
						
						var valorY;
						
						if($('#spreadMercLab').text() != '-'){
							valorY = $('#spreadMercLab').text().replace(' %' , '');
						} else {
							valorY = $('#YtmnMercadoLab').text().replace(' %' , '');
						}
						var datosle3 = [{
				            name: $('#tickerMercadoLab').text(),
				            y: Number(valorY),
				            x: Number($('#durationMercadoLab').text())
				        }];		
						
						datosle.push( [ Number($('#durationMercadoLab').text()), Number(valorY) ] );	
						
						graficarCompararBonos(datosle, datosle2, datosle3,  'Bonos Comparables', sppa);
												
						optionTable = {
						        data: dataSet,
								"autoWidth": false,
						        cache: false,
						        bDestroy: true,
						        "oLanguage": {
						        	"oPaginate": {					        	
						        	"sPrevious": "<",
						        	"sNext": ">",				        	
						        	},
						 			"sInfo": " _START_ - _END_ de _TOTAL_ items",
						 			"sEmptyTable": "No se encontraron datos"
						        },					         
						        "bFilter": false,
						        "bLengthChange": false,
						        "iDisplayLength": 100,
						        "order": [[ 3, "asc" ]],					        
						        columns: [{ title: "Ticker", "width": "11%", "targets": 0 },
								            { title: "Precio", "width": "11%", "targets": 0 },
								            { title: "Cupón", "width": "11%", "targets": 0 },
								            { title: "YTM (anual)", "width": "11%", "targets": 0 },
								            { title: "YTM (nominal)", "width": "11%", "targets": 0 },
								            { title: "Spread/Mercado", "width": "11%", "targets": 0 },
								            { title: "Duration", "width": "11%", "targets": 0 },
								            { title: "Vencimiento", "width": "11%", "targets": 0 ,  "sType": "date-uk" },
								            { title: "Frec.Pago", "width": "12%", "targets": 0  }]
						    };
											
					}
				} else {					
					vaciarTabla = true;															
				}
				
				var oTable = $('#tablaBonosSimilares').DataTable(optionTable);
				
				 oTable.$('tr').tooltip( {
				        "delay": 0,
				        "track": true,
				        "fade": 250
				    } );
				
			}
		});
		
	} else {
		if($('#tablaBonosSimilares').html() != ''){
			var table = $('#tablaBonosSimilares').DataTable();
			table.destroy();			    
			$('#tablaBonosSimilares').empty(); 
		}
		
		vaciarTabla = true;		
	}
	
	
	if (vaciarTabla ) {
		var columnas;
		
		
		
		if($('#tickerMercadoBDLab').text() == ''){					
			
			columnas = [{ title: "Ticker", "width": "11%", "targets": 0 },
			            { title: "Precio", "width": "11%", "targets": 0 },
			            { title: "Cupón", "width": "11%", "targets": 0 },
			            { title: "YTM (anual)", "width": "11%", "targets": 0 },
			            { title: "YTM (nominal)", "width": "11%", "targets": 0 },
			            { title: "Spread/Mercado", "width": "11%", "targets": 0 },
			            { title: "Duration", "width": "11%", "targets": 0 },
			            { title: "Vencimiento", "width": "11%", "targets": 0 ,  "sType": "date-uk" },
			            { title: "Frec.Pago", "width": "12%", "targets": 0  }];
		} else {
			columnas = [{ title: "Ticker", "width": "17%", "targets": 0},
			            { title: "Vencimiento", "width": "17%", "targets": 0,  "sType": "date-uk" },
			            { title: "Moneda", "width": "17%", "targets": 0 },
			            { title: "Precio" ,"width": "16%", "targets": 0 },
			            { title: "Dias Restantes", "width": "16%", "targets": 0 },
			            { title: "TNA", "width": "17%", "targets": 0 }];
		}
		
						
		
		optionTable = {						       
					data: [],
					"autoWidth": false,
			        cache: false,
			        bDestroy: true,
			        "oLanguage": {
			        	"oPaginate": {					        	
			        	"sPrevious": "<",
			        	"sNext": ">",				        	
			        	},
			 			"sInfo": " _START_ - _END_ de _TOTAL_ items",
			 			"sEmptyTable": "No se encontraron datos"
			        },					         
			        "bFilter": false,
			        "bLengthChange": false,
			        "iDisplayLength": 20,
			        columns: columnas
			    };
		
												
	
	
		$('#tablaBonosSimilares').DataTable(optionTable);
	}
	
	
	
};



function cargarProspecto(){
	var ticker = $('#selecTicker').val();
		
	if (ticker != null && ticker != '') {	
	
		$.get("/calculadoraDeBonos/prospecto/"+ticker , null ,function(data, status){
			data = $.parseJSON(JSON.stringify(data));
			var valida = validarAutorizacion(data);
			if(valida == 'ok') {
								
				$("#tablaCondicionesEm").find("tr").remove();
				
				for(i=0;i<data.length;i++){		
					$('#tablaCondicionesEm').append('<tr><td width="80%">'+data[i]+'</td> <td width="20%"><a  onclick="abrirPDF(this.id);" class="btn btn-primary btn-descargar" id="'+(i+1)+'"><font color="white">Descargar</font></a></td> </tr>');
					
				};
			}
		});		
	}
	
};



function cargarAvisos(){
	var ticker = $('#selecTicker').val();
		
	if (ticker != null && ticker != '') {	
	
		$.get("/calculadoraDeBonos/avisos/"+ticker , null ,function(data, status){
			data = $.parseJSON(JSON.stringify(data));
			var valida = validarAutorizacion(data);
			if(valida == 'ok') {
								
				$("#tablaAvisosPago").find("tr").remove();
				
				for(i=0;i<data.length;i++){		
					$('#tablaAvisosPago').append('<tr><td width="80%">'+data[i]+'</td> <td width="20%"><a  onclick="abrirPDFavisos(this.id);" class="btn btn-primary btn-descargar" id="'+(i+1)+'"><font color="white">Descargar</font></a></td> </tr>');
					
				};
			}
		});		
	}
	
};


function abrirPDF(byteArray){

	var descripPdf = $("#tablaCondicionesEm tr:nth-child("+byteArray+") td:eq(0)").text();
	var ticker = $('#selecTicker').val();
	
	$.get("/calculadoraDeBonos/prospecto/"+descripPdf+"/"+ticker , {descripPdf: descripPdf} ,function(data, status){
		data = $.parseJSON(JSON.stringify(data));
		var valida = validarAutorizacion(data);
		if(valida == 'ok') {
			
			let pdfWindow = window.open("");
			pdfWindow.document.write("<iframe width='100%' height='100%' src='data:application/pdf;base64, " + encodeURI(data) + "'></iframe>");
		}
	});
}

function abrirPDFavisos(byteArray){

	var descripPdf = $("#tablaAvisosPago tr:nth-child("+byteArray+") td:eq(0)").text();
	var ticker = $('#selecTicker').val();
	
	$.get("/calculadoraDeBonos/avisos/"+descripPdf+"/"+ticker , {descripPdf: descripPdf} ,function(data, status){
		data = $.parseJSON(JSON.stringify(data));
		var valida = validarAutorizacion(data);
		if(valida == 'ok') {
			
			let pdfWindow = window.open("");
			pdfWindow.document.write("<iframe width='100%' height='100%' src='data:application/pdf;base64, " + encodeURI(data) + "'></iframe>");
		}
	});
}

function cargarSensibilidad(){
	if($('#variacionPrecioInp').val() == null || $('#variacionPrecioInp').val() == ''){
		$('#variacionPrecioInp').val('1');
		$('#variacionCambioInp').val('1');
		$('#variacionTirInp').val('1');
						
		sensibilidadPrecio();
		sensibilidadTirSpread();
		sensibilidadTipoCambio();
		
	} else {
		 var sensPrecio = $('#tablaSensPrecio tr').length;
		 var sensTirSpread =  $('#tablaSensCambio tr').length;
		 var sensTipoCambio =  $('#tablaSensTir tr').length;
		 
		 if(sensPrecio == 1){
			 sensibilidadPrecio();
		 }
		 if(sensTirSpread == 1){
			 sensibilidadTirSpread();
		 }
		 if(sensTipoCambio == 1){
			 sensibilidadTipoCambio();
		 }		 
	}	
};

function sensibilidadPrecio(){
	var variacion = $('#variacionPrecioInp').val();
	
	if(variacion != null && variacion > 0 && $('#tirEfecLab').text() != '' ){
	
		var ticker = $('#selecTicker').val();
		var fechaLiquidacion =  $('#fechaLiqinp').val();
	
		var precio = getPrecio();	
		var tipoCambio = getTipoCambio();	
		var moneda = $('#tipoMonedaSel').val();
		var tipoPrecio = $('#tipoPrecioSel').val();
		
		var proxCup = getTasaProxCup();
		var restCup = getTasaRestCup();
		
		
		var precioDos = dosDecimales(precio);
		
		$.get("/calculadoraDeBonos/sensIndicadores/"+ticker+"/"+fechaLiquidacion+"/"+precio+"/"+tipoPrecio+"/"+moneda+"/"+tipoCambio+"/"+proxCup+"/"+restCup+"/"+getDolarFut()+"/"+variacion+"/s" , null ,function(data, status){
			data = $.parseJSON(JSON.stringify(data));
			var valida = validarAutorizacion(data);
			if(valida == 'ok') {				
				 	$("#tablaSensPrecio").find("tr:gt(0)").remove();
				 	for(i=0;i<data.indicadores.length;i++){
				 		var precioSens = dosDecimales(data.indicadores[i]['precio']);
						
				 		var tirSpread;
				 		if($('#tirCard').text() == 'TIR Requerida') {
				 			tirSpread = separadorMiles(dosDecimales(data.indicadores[i]['tir']));
						} else if($('#tirCard').text() == 'Spread Requerido') {	
							tirSpread = separadorMiles(dosDecimales(data.indicadores[i]['spreadmercado']));
						}
				 		
				 		if(precioSens == precioDos){
				 			$('#tablaSensPrecio tr:last').after('<tr><td><b>'+separadorMiles(precioSens)+'</b></td> <td><b>'+tirSpread+'%</b></td> <td><b>'+separadorMiles(dosDecimales(data.indicadores[i]['durationmodificada']))+'</b></td> <td><b>'+separadorMiles(dosDecimales(data.indicadores[i]['paridad']))+'%</b></td></tr>');
				 		}
				 		else {
				 			$('#tablaSensPrecio tr:last').after('<tr><td>'+separadorMiles(precioSens)+'</td> <td>'+tirSpread+'%</td> <td>'+separadorMiles(dosDecimales(data.indicadores[i]['durationmodificada']))+'</td> <td>'+separadorMiles(dosDecimales(data.indicadores[i]['paridad']))+'%</td></tr>');
				 		}				 		
				 	
				 	};
			}
		});
				
	}
	
}

function sensibilidadTirSpread(){	
	$("#tablaSensTir").find("tr:gt(0)").remove();
	
	var variacion = $('#variacionTirInp').val();
	
	if(variacion != '0' && variacion != ''){
		
		if($('#tirCard').text() == 'TIR Requerida') {
			var valor = $('#tirEfecLab').text().replace(' %', '');
			
			if(valor != ''){
				$.get("/calculadoraDeBonos/tirSens/"+$('#fechaLiqinp').val()+"/"+$('#selecTicker').val()+"/"+valor+"/"+getTasaProxCup()+"/"+getTasaRestCup()+"/"+getDolarFut()+"/"+variacion+"/"+getPrecio()+"/c", null ,function(data, status){
					data = $.parseJSON(JSON.stringify(data));
					var valida = validarAutorizacion(data);
					if(valida == 'ok') {
						
						var tirSpread = $('#tirEfecLab').text().replace(' %', '');
						
						for(i=0;i<data.precio.length;i++){
							var tirSpreadSens = data.precio[i]['tirrequerida'];
							
							if(tirSpread == tirSpreadSens){
								$('#tablaSensTir tr:last').after('<tr><td><b>'+separadorMiles(dosDecimales(tirSpreadSens))+'%</b></td> <td><b>'+separadorMiles(dosDecimales(data.precio[i]['precio']))+'</b></td> <td><b>'+data.precio[i]['variacionPrecio']+'</b></td> <td><b>'+data.precio[i]['variacionAbsolutaPrecio']+'</b></td></tr>');
							} else{							
								$('#tablaSensTir tr:last').after('<tr><td>'+separadorMiles(dosDecimales(tirSpreadSens))+'%</td> <td>'+separadorMiles(dosDecimales(data.precio[i]['precio']))+'</td> <td>'+data.precio[i]['variacionPrecio']+'</td> <td>'+data.precio[i]['variacionAbsolutaPrecio']+'</td></tr>');
							}
						}
					}
				});
			}			
			
		} else if($('#tirCard').text() == 'Spread Requerido')  {	
			var valor = $('#spreadMercadoLab').text().replace(' %', '');
			
			if(valor != ''){
				$.get("/calculadoraDeBonos/spreadSens/"+$('#fechaLiqinp').val()+"/"+$('#selecTicker').val()+"/"+valor+"/"+getTasaProxCup()+"/"+getTasaRestCup()+"/"+getDolarFut()+"/"+variacion+"/"+getPrecio()+"/c", null ,function(data, status){
				data = $.parseJSON(JSON.stringify(data));
					var valida = validarAutorizacion(data);
					if(valida == 'ok') {
						
						var tirSpread = $('#spreadMercadoLab').text().replace(' %', '');
						
						for(i=0;i<data.precio.length;i++){
							var tirSpreadSens = data.precio[i]['spreadrequerido'];
							
							if(tirSpread == tirSpreadSens){
								$('#tablaSensTir tr:last').after('<tr><td><b>'+separadorMiles(dosDecimales(tirSpreadSens))+'%</b></td> <td><b>'+separadorMiles(dosDecimales(data.precio[i]['precio']))+'</b></td> <td><b>'+data.precio[i]['variacionPrecio']+'</b></td> <td><b>'+data.precio[i]['variacionAbsolutaPrecio']+'</b></td></tr>');
							}else{
								$('#tablaSensTir tr:last').after('<tr><td>'+separadorMiles(dosDecimales(tirSpreadSens))+'%</td> <td>'+separadorMiles(dosDecimales(data.precio[i]['precio']))+'</td> <td>'+data.precio[i]['variacionPrecio']+'</td> <td>'+data.precio[i]['variacionAbsolutaPrecio']+'</td></tr>');
							}
						}
					}
				});
			}
		}
	}
}

function sensibilidadTipoCambio(){
	
	var precio = getPrecio();	
	var tipoCambio = getTipoCambio();
	var variacion = $('#variacionCambioInp').val();
	var moneda = $('#tipoMonedaSel').val();
		
		
	if(precio > 0 && tipoCambio > 0 && variacion > 0 ){
		
		$("#tablaSensCambio").find("tr:gt(0)").remove();
		if(moneda == 'Pesos'){
			
			$('#precioSensTC1').text('Precio en USD');
			$('#precioSensTC2').text('Precio en Pesos');
			
			for(i=0;i<4;i++){
				tipoCambio = tipoCambio - ((tipoCambio * variacion) / 100);
					$('#tablaSensCambio tr:first').after('<tr><td>'+separadorMiles(dosDecimales(tipoCambio))+'</td><td>'+separadorMiles(dosDecimales(precio/tipoCambio))+'</td><td>'+separadorMiles(dosDecimales(precio))+'</td></tr>');
				};
				
				var tipoCambio = getTipoCambio();
				$('#tablaSensCambio tr:last').after('<tr><td><b>'+separadorMiles(dosDecimales(tipoCambio))+'</b></td><td><b>'+separadorMiles(dosDecimales(precio/tipoCambio))+'</b></td><td><b>'+separadorMiles(dosDecimales(precio))+'</b></td></tr>');
										
				for(i=0;i<4;i++){
					tipoCambio = tipoCambio + ((tipoCambio * variacion) / 100);
					$('#tablaSensCambio tr:last').after('<tr><td>'+separadorMiles(dosDecimales(tipoCambio))+'</td><td>'+separadorMiles(dosDecimales(precio/tipoCambio))+'</td><td>'+separadorMiles(dosDecimales(precio))+'</td></tr>');
				};
			
		} else {
			$('#precioSensTC1').text('Precio en Pesos');
			$('#precioSensTC2').text('Precio en '+ moneda);
			
			for(i=0;i<4;i++){
			tipoCambio = tipoCambio - ((tipoCambio * variacion) / 100);
				$('#tablaSensCambio tr:first').after('<tr><td>'+separadorMiles(dosDecimales(tipoCambio))+'</td><td>'+separadorMiles(dosDecimales(precio*tipoCambio))+'</td><td>'+separadorMiles(dosDecimales(precio))+'</td></tr>');
			};
			
			var tipoCambio = getTipoCambio();
			$('#tablaSensCambio tr:last').after('<tr><td><b>'+separadorMiles(dosDecimales(tipoCambio))+'</b></td><td><b>'+separadorMiles(dosDecimales(precio*tipoCambio))+'</b></td><td><b>'+separadorMiles(dosDecimales(precio))+'</b></td></tr>');
									
			for(i=0;i<4;i++){
				tipoCambio = tipoCambio + ((tipoCambio * variacion) / 100);
				$('#tablaSensCambio tr:last').after('<tr><td>'+separadorMiles(dosDecimales(tipoCambio))+'</td><td>'+separadorMiles(dosDecimales(precio*tipoCambio))+'</td><td>'+separadorMiles(dosDecimales(precio))+'</td></tr>');
			};
			
		}
		
	 	
	}
}

function actualizarTirSpread(){
	 if($('#tirReqInp').val() != null && $('#tirReqInp').val() != ''){
		  actualizarTirSpreadReq($('#tirReqInp').val());
	  }
	  if($('#spreadTrimReqInp').val() != null && $('#spreadTrimReqInp').val() != ''){
		  actualizarSpreadTrimReq($('#spreadTrimReqInp').val());
	  }
}


function dosDecimales(valor){
	var a = '';
	
	if (valor != null){
		try { 
			a = a.replace('"',''); 
		} catch{}
		
		try { 
			a = Number(valor);
			a = a.toFixed(2);		
		} catch{ }
	}
	return a;
}

function cuatroDecimales(valor){
	var a = '';
	if (valor != null){
	try { 
		a = a.replace('"',''); 
	} catch{}
	
	try { 
		a = Number(valor);
		a = a.toFixed(4);		
	} catch{ }
	}
	return a;
}

function seisDecimales(valor){
	var a = '';
	if (valor != null){
	try { 
		a = a.replace('"',''); 
	} catch{}
	
	try { 
		a = Number(valor);
		a = a.toFixed(6);		
	} catch{ }
	}
	return a;
}

function separadorMiles(x) {
	var res = x.split(".");
	var entero =  res[0].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	var devolv;
	
	if(res[1] != null){
		devolv = entero +'.' +res[1]
	}else{
		devolv= entero;
	};
	
	return devolv;
}

function cambioSelectTasa(valor){
	if(valor =='Proy. Mercado'){				
		$('#badlarProxCupLab').val($('#badlarProxCup').val());				
				
		$('#badlarProxCupLab').attr('readonly', true);
		$('#badlarRestCupLab').attr('readonly', true);
		
		obteneFlujosIndicadoresProxCupon('s','s','s','x');
		actualizarTirSpread();
	} else if (valor =='Prom. Ponderado'){		
		$('#badlarProxCupLab').val($('#badlarProxCupPondLab').val());
		
		$('#badlarProxCupLab').attr('readonly', true);
		$('#badlarRestCupLab').attr('readonly', true);
		
		obteneFlujosIndicadoresProxCupon('s','s','s','x');
		actualizarTirSpread();
	} else {			
		$('#badlarProxCupLab').attr('readonly', false);
		$('#badlarRestCupLab').attr('readonly', false);	
	}
}


function actualizarValuacionCartera(){
	
	var tenencia = $('#cantidadNomInp').val();
	
	if(tenencia != ''){
		var valortec = $('#valorTecLab').text().replace(',','');
		$('#capitalLab').text(separadorMiles(dosDecimales(tenencia * (valortec /100))));
		
		var precioCash;
		var modenaSel = $('#tipoMonedaSel').val();
		var cambio = getTipoCambio();
		
		if($('#monedaPrecioTirLab').text() == 'Precio en AR$:'){
			precioCash = 'P';
		} else{
			precioCash = 'O';
		}
		
		var tipoPrecio = $('#tipoPrecioSel').val();
		var precio = '';
		
		if(tipoPrecio == 'Clean'){
			precio = varCleanDirty;
		}else {
			precio = $('#PrecioInp').val();	
		}
				
		
		if(precio != ''){
			//ver si el precio es en pesos y el precio en dolares convertir a tipo de cambio
						
			if(modenaSel == 'Pesos' && precioCash == 'O'){
				$('#tenValDolLab').text(separadorMiles( dosDecimales( ( (tenencia * (precio/ cambio)) / 100))));				
								
			} else if (precioCash == 'P' && modenaSel != 'Pesos'){
				$('#tenValDolLab').text(separadorMiles(dosDecimales(((tenencia * (precio * cambio)) / 100))));
			} else {
								
				var c = separadorMiles(dosDecimales(( (tenencia * precio) / 100)));
				
				$('#tenValDolLab').text(c);
			}		
						
			var tenenciaPO = $('#tenValDolLab').text().replace(/[#,]/g,'');
			$('#tenValPesosLab').text(separadorMiles(dosDecimales(tenenciaPO * cambio)));				
			
			
		}else{
			$('#tenValDolLab').text('');
			$('#tenValPesosLab').text('');
		}		
		
	} else {
		$('#capitalLab').text('');
		$('#tenValDolLab').text('');
		$('#tenValPesosLab').text('');
	}
};

function getTasaProxCup(){
	try{
		var a = $('#badlarProxCupLab').val();
	
		if (a != null  && a != '' ){
			a = Number($('#badlarProxCupLab').val());
			return a;
		}
		
	} catch(err){
		console.log(err);
	}
	
	return 0;
}

function getTasaRestCup(){
	try{
		var a = $('#badlarRestCupLab').val();
		if (a != null  && a != '' ){
			a = Number($('#badlarRestCupLab').val());
			return  a;
		}
	} catch(err){		
	}
	
	return 0;
}

function getDolarFut(){
	try{
		var a = $('#DolarFutInp').val();
		if (a != null  && a != '' ){
			a = Number($('#DolarFutInp').val());
			return  a;
		}
	} catch(err){		
	}
	
	return 0;
}

function getTipoCambio(){
	try{
		var a = $('#TipoCambioInp').val(); 
		if (a != null  && a != '' ){
			a = Number($('#TipoCambioInp').val()); 
			return a;
		}
	}		
	catch(err){		
	}
	return 1;
}

function getPrecio(){

	try{
		var a = $('#PrecioInp').val();
		if (a != null  && a != '' ){
			a = Number($('#PrecioInp').val());
			return a;
		}
	} catch(err){		
	}
	return 0;
}

function actualizarSpreadTrimReq(valor){
	if(valor == null || valor == ''){
		$('#precioSpreadTrimLab').text('');
	} else{
		if($('#selecTicker').val() != '' && valor != ''){
				$.get("/calculadoraDeBonos/spreadTrimReq/"+$('#fechaLiqinp').val()+"/"+$('#selecTicker').val()+"/"+valor+"/"+getTasaProxCup()+"/"+getTasaRestCup()+"/"+getDolarFut()+"/c" , null ,function(data, status){
					data = $.parseJSON(JSON.stringify(data));
					var valida = validarAutorizacion(data);
					if(valida == 'ok') {
						try{
							if(data.precio[0]['spreadrequeridotrimestral'] != null){
								$('#precioSpreadTrimLab').text(separadorMiles(dosDecimales((data.precio[0]['spreadrequeridotrimestral']))));
							} else {
								$('#precioSpreadTrimLab').text('');
							};
						} catch {}
					}
				});		
		}
	}
}

function actualizarTirSpreadReq(valor){
	if(valor == null || valor == ''){
		$('#precioTirLab').text('');
	} else{
		if($('#selecTicker').val() != '' && valor != ''){
			if($('#tirCard').text() == 'TIR Requerida') {
				
				$.get("/calculadoraDeBonos/tirReq/"+$('#fechaLiqinp').val()+"/"+$('#selecTicker').val()+"/"+valor+"/"+getTasaProxCup()+"/"+getTasaRestCup()+"/"+getDolarFut()+"/c", null ,function(data, status){
					data = $.parseJSON(JSON.stringify(data));
					var valida = validarAutorizacion(data);
					if(valida == 'ok') {
						try{
							if(data.precio[0]['tirrequerida'] != null){
								$('#precioTirLab').text(separadorMiles(dosDecimales((data.precio[0]['tirrequerida']))));
							} else {
								$('#precioTirLab').text('');
							}
						} catch {}
					}
				});
				
			} else if($('#tirCard').text() == 'Spread Requerido')  {			
				$.get("/calculadoraDeBonos/spreadReq/"+$('#fechaLiqinp').val()+"/"+$('#selecTicker').val()+"/"+valor+"/"+getTasaProxCup()+"/"+getTasaRestCup()+"/"+getDolarFut()+"/c" , null ,function(data, status){
				data = $.parseJSON(JSON.stringify(data));
					var valida = validarAutorizacion(data);
					if(valida == 'ok') {
						try{
							if(data.precio[0]['spreadrequerido'] != null){
								$('#precioTirLab').text(separadorMiles(dosDecimales((data.precio[0]['spreadrequerido']))));
							} else {
								$('#precioTirLab').text('');
							}
						} catch {}
					}
				});
			} else {
				$.get("/calculadoraDeBonos/tnaReq/"+$('#fechaLiqinp').val()+"/"+$('#selecTicker').val()+"/"+valor+"/"+getTasaProxCup()+"/"+getTasaRestCup()+"/"+getDolarFut() +"/c" , null ,function(data, status){
					data = $.parseJSON(JSON.stringify(data));
						var valida = validarAutorizacion(data);
						if(valida == 'ok') {
							try{
								if(data.precio[0]['tnarequ'] != null){
									$('#precioTirLab').text(separadorMiles(dosDecimales((data.precio[0]['tnarequ']))));
								} else {
									$('#precioTirLab').text('');
								}
							} catch {}
						}
					});
			}
		}
	}
}

function cambioNominales(){
	var fech = $('#fechaLiqinp').val();
	var ticker = $('#selecTicker').val();
	var nominales = $('#cantidadNomInp').val();
	
	var proxCup = getTasaProxCup();
	var restCup = getTasaRestCup();
	
	if (ticker != null) {		
		obteneFlujosIndicadoresProxCupon('s', 'n', 's','x');		
	}
};

function bloqueProxCupon(data){
	
	if(data.proxCup[0] != null) {
			
		$('#cupLab').text(data.cupon[0]['obtenercupon']);
		$('#cuponMercadoLab').text($('#cupLab').text());
		
		try{
			if ((data.proxCup[0]['amort']) == '0') {
				$('#amortTenenciaLab').text('-');
					
			} else {
				$('#amortTenenciaLab').text(separadorMiles(dosDecimales((data.proxCup[0]['amort']))));
			}
		} catch{}
		
		try{
			if(data.proxCup[0]['renta'] != null){
				$('#rentaTenenciaLab').text(separadorMiles(dosDecimales((data.proxCup[0]['renta']))));
			}
		} catch{} 
		
		var modena = data.flujo[0]['tipo_moneda'];
		
		try{
			if(data.proxCup[0]['total'] != null){
				$('#TotalRentTenenciaLab1').text(separadorMiles(dosDecimales((data.proxCup[0]['total']))));
			}
		} catch{}
		
		if (modena == '1'){
			$('#total1').text('Total en AR$');
			$('#total2').text('Total en U$D');			
			$('#rowtotal2').hide();
			
		} else {
								
			var TotalMonedaCash = (data.proxCup[0]['total']);
			
			$('#rowtotal2').show();
			
			TotalMonedaCash = TotalMonedaCash * getTipoCambio();
			$('#TotalRentTenenciaLab2').text(separadorMiles(dosDecimales(TotalMonedaCash)));
								
			 if (modena == '2') {
					$('#total1').text('Total en U$D');
					$('#total2').text('Total en AR$');
					
				} else if (modena == '3') {
					$('#total1').text('Total en Eur');
					$('#total2').text('Total en AR$');
					
				} else if (modena == '4') {
					$('#total1').text('Total en Uvas');
					$('#total2').text('Total en AR$');				
				}
		}
		
		actualizarValuacionCartera();
	
	} else {
		$('#cupLab').text('');
		$('#cuponMercadoLab').text('');
		$('#amortTenenciaLab').text('');
		$('#rentaTenenciaLab').text('');
		$('#TotalRentTenenciaLab1').text('');
		$('#TotalRentTenenciaLab2').text('');
	}
}
	
		
		
function bloqueIndicadores(data){
	$('#tirEfecLab').text('');
	$('#TirNominlLab').text('');
	$('#TasaNominlLab').text('');
	$('#spreadMercadoLab').text('');
	$('#currentYieldLab').text('');
	$('#valorResLab').text('');
	$('#valorParLab').text('');
	$('#interesesCorrLab').text('');
	$('#intCorrTituloLab').text('Intereses corridos');
	$('#valorTecLab').text('');
	$('#paridadaLab').text('');
	$('#modifDur').text('');
	$('#dv01').text('');
	$('#termToMaturLab').text('');	
	$('#PrecioCleanaDirtyInp').text('');
	$('#ppvLab').text('');
	$('#presenciaLab').text('');
	$('#volPromOperadoLab').text('');
	$('#laminaLab').text('');
	$('#leyLab').text('');
	$('#pagaEnRow').hide();
	$('#pagaEnLab').text('');
	
	var tipoBono = data.indicadores[0]['tipobono'];
	var tipoCupon = data.indicadores[0]['tipocupp'];
	  
	try{
		
		var textTipoPrecio;		
		if($('#tipoPrecioSel').val() == 'Dirty'){
			var textTipoPrecio = "Clean";
		} else {
			var textTipoPrecio = "Dirty";
		}						
		var textMoneda = $('#tipoMonedaSel').val();		
		$('#cleanDerLib').text( textTipoPrecio + ' en ' + textMoneda + ": ");		
		
		var precioCD = separadorMiles(cuatroDecimales(data.indicadores[0]['preciocleandirtyimporte']));
		$('#PrecioCleanaDirtyInp').text(precioCD);	
		varCleanDirty = data.indicadores[0]['preciocleandirtyimporte'];
		
		if(data.indicadores[0]['tipocotizacion'] == 'D'){
			$('#PrecioCleanaDirtyRow').show();
			var precioCDP = separadorMiles(cuatroDecimales(data.indicadores[0]['preciocleandirtyporcentaje']));
			$('#PrecioCleanaDirtyInpPor').text(precioCDP);
			$('#cleanDerLibPor').text( textTipoPrecio + " en % : ");			
		} else {
			$('#PrecioCleanaDirtyRow').hide();
		}
		
	} catch{}
		
	if(tipoBono != 'K'){
		//med ren
		try{
			if(data.indicadores[0]['tir'] != null){
				$('#tirEfecLab').text( separadorMiles(dosDecimales((data.indicadores[0]['tir']))) + ' %');
			}
		} catch{}
		
		//if (tipoBono != 'L'  && tipoBono != 'D' && tipoBono != 'E'){	
			try{
				if(data.indicadores[0]['tasanominal'] != null){
					$('#TirNominlLab').text( separadorMiles(dosDecimales((data.indicadores[0]['tasanominal'])))+ ' %');	 
				}	 
			} catch{}
		//}
	}
	
	try{
		if(data.indicadores[0]['tna'] != null){
			$('#TasaNominlLab').text( separadorMiles(dosDecimales((data.indicadores[0]['tna'])))+ ' %');	 
		}	 
	} catch{}	
	
	if(tipoCupon == 'D' || $('#proxCupLab').text() ==  $('#fechaVencLab').text()){
		$('#tnatr').show();
	} else {
		$('#tnatr').hide();
	}
	
	try{
		if(data.indicadores[0]['spreadmercado'] != null){	
			$('#spreadMercadoLab').text( separadorMiles(dosDecimales((data.indicadores[0]['spreadmercado'])))+ ' %');
		}
	}catch{}
	try{
		if(data.indicadores[0]['currentyield'] != null){	
			$('#currentYieldLab').text( separadorMiles(dosDecimales((data.indicadores[0]['currentyield'])))+ ' %');
		}
	}catch{}
   //vlcin  
	
	try{
		if(data.indicadores[0]['vr'] != null){
			$('#valorResLab').text(dosDecimales((data.indicadores[0]['vr'])) + ' %');
		}
	}catch{}
	try{
		if(data.indicadores[0]['valorpar'] != null){
			$('#valorParLab').text(separadorMiles(dosDecimales((data.indicadores[0]['valorpar']))));
		}
	}catch{}
	try{
		if(data.indicadores[0]['int_corr'] != null){
			$('#interesesCorrLab').text(separadorMiles(dosDecimales((data.indicadores[0]['int_corr']))));
		}
	}catch{}
	try{
		if(data.indicadores[0]['diasintcorr'] != null){
			$('#intCorrTituloLab').text('Intereses corridos (' + data.indicadores[0]['diasintcorr'] +' dias)');
		} else {
			$('#intCorrTituloLab').text('Intereses corridos');
		}
	} catch {}
	try{
		if(data.indicadores[0]['valortecnico'] != null){
			$('#valorTecLab').text(separadorMiles(dosDecimales(data.indicadores[0]['valortecnico'])));		
		}	
	}catch{}
	try{
		if(data.indicadores[0]['paridad'] != null){
			$('#paridadaLab').text( separadorMiles(dosDecimales((data.indicadores[0]['paridad'])))+ ' %');
		}
	}catch{}
		
   // med sen
	if (tipoBono != 'D' && tipoBono != 'E'){
		try{
			if(data.indicadores[0]['durationmodificada'] != null){
				$('#modifDur').text( separadorMiles(dosDecimales((data.indicadores[0]['durationmodificada']))));
			}
		}catch{}
		try{
			if(data.indicadores[0]['dv'] != null){
				$('#dv01').text( separadorMiles(dosDecimales((data.indicadores[0]['dv']))));
			}
		}catch{}
		
	}
	try{
		if(data.indicadores[0]['ppv'] != null){
			$('#ppvLab').text( separadorMiles(dosDecimales((data.indicadores[0]['ppv']))));
		}
	}catch{}
	
	try{
		if(data.indicadores[0]['liquidez'] != null){
			$('#presenciaLab').text(dosDecimales( data.indicadores[0]['liquidez']) + ' %');
		}
	}catch{}
	
	try{
		if(data.laminaLey[0]['laminaminima'] != null){
			$('#laminaLab').text( separadorMiles(data.laminaLey[0]['laminaminima'])  );
		}
	}catch{}
	
	try{
		if(data.laminaLey[0]['ley'] != null){
			$('#leyLab').text( data.laminaLey[0]['ley']);
		}
	}catch{}
	 
	try{
		if(data.laminaLey[0]['pagaen'] != null && data.laminaLey[0]['pagaen'].length > 1){
			$('#pagaEnRow').show("slow");
			$('#pagaEnLab').text( data.laminaLey[0]['pagaen']);
		}
	}catch{}
	
	try{
		if(data.indicadores[0]['voloperado'] != null){
			$('#volPromOperadoLab').text( separadorMiles(dosDecimales(data.indicadores[0]['voloperado'])));
		}
	}catch{}
	
	try{
		if(data.indicadores[0]['termtomat'] != null){
			$('#termToMaturLab').text( separadorMiles(dosDecimales((data.indicadores[0]['termtomat']))));
		}
	}catch{}
  
   var interesesCorridos = Number( $('#interesesCorrLab').text().replace(/[#,]/g,''));	  
   var cambio = getTipoCambio();
   var precio = getPrecio();

   
 
  
	
   if (tipoBono == 'L'  || tipoBono == 'D' || tipoBono == 'E'){		
		$('#tickerMercadoBDLab').text($('#selecTicker').val());
		$('#vencimientoMercadoBDLab').text($('#fechaVencLab').text());																			
		$('#precioMercadoBDLab').text($('#PrecioInp').val());
		$('#monedaMercadoBDLab').text($('#tipoMonedaSel').val());		
		try{
			$('#diasRestantesMercadoBDLab').text(separadorMiles(data.indicadores[0]['diasrestantes']));
		} catch{
			$('#diasRestantesMercadoBDLab').text('');
		}
		$('#TnaMercadoBDLab').text( $('#TasaNominlLab').text());	
		
	}  else {
		$('#tickerMercadoBDLab').text('');
		$('#tickerMercadoLab').text($('#selecTicker').val());		
		$('#precioMercadoLab').text($('#PrecioInp').val());		
		$('#cuponMercadoLab').text($('#cupLab').text());
		// $('#monedaMercadoLab').text($('#tipoMonedaSel').val());			
		$('#YtmaMercadoLab').text($('#tirEfecLab').text());
		$('#YtmnMercadoLab').text($('#TirNominlLab').text());
		$('#vencimientoMercadoLab').text($('#fechaVencLab').text());
		$('#frecuenciaMercadoLab').text($('#frecAnualLab').text());
		
		
		
		if(tipoCupon == 'B' ||  tipoCupon == 'T' || tipoCupon == 'P' || tipoCupon == 'L'  || tipoCupon == 'G' ){
			$('#spreadMercLab').text($('#spreadMercadoLab').text());
		} else {
			$('#spreadMercLab').text('-');
		}
		
		if($('#frecAnualLab').text()== '4'  ){
			$('#frecuenciaMercadoLab').text('Trimestral');
		}  else if ($('#frecAnualLab').text() == '2'  ){
			frecuTabla =  'Semestral';			
		} else if ($('#frecAnualLab').text() == '6'  ){
			frecuTabla =  'Bimestral';			
		} else if ($('#frecAnualLab').text() == '12' ){
					
			 if (tipoBono=='L' || tipoBono=='E' ){
				$('#frecuenciaMercadoLab').text('Bullet');	
			 } else{
				 $('#frecuenciaMercadoLab').text('Mensual');	
			 }
		}
		
		$('#durationMercadoLab').text($('#modifDur').text());
		//$('#interesesMercadoLab').text( $('#interesesCorrLab').text());
		//$('#porxCupMercadoLab').text($('#proxCupLab').text());
	}
   
}

function bloqueFlujos(data){
    $("#tablaFlujos").find("tr:gt(0)").remove();
	for(i=0;i<data.flujo.length;i++){
					
		try{
			var fecha1 = fechaFormateada(new Date(data.flujo[i]['fecha'].replace(/[#-]/g, "/")));
			var fecha2 = fechaFormateada(new Date(data.flujo[i]['fechaproxcupon'].replace(/[#-]/g, "/")));
			
			if (fecha1 == fecha2){
				$('#tablaFlujos tr:last').after('<tr><td><b>'+fecha1+'</b></td> <td><b>'+separadorMiles(dosDecimales(data.flujo[i]['vr']))+'</b></td> <td><b>'+separadorMiles(dosDecimales(data.flujo[i]['renta']))+'</b></td> <td><b>'+separadorMiles(dosDecimales(data.flujo[i]['amort']))+'</b></td> <td><b>'+data.flujo[i]['rentaamort']+'</b></td> <td><b>'+separadorMiles(dosDecimales(data.flujo[i]['total']))+'</b></td></tr>');
			} else {
				$('#tablaFlujos tr:last').after('<tr><td>'+fecha1+'</td> <td>'+separadorMiles(dosDecimales(data.flujo[i]['vr']))+'</td> <td>'+separadorMiles(dosDecimales(data.flujo[i]['renta']))+'</td> <td>'+separadorMiles(dosDecimales(data.flujo[i]['amort']))+'</td> <td>'+data.flujo[i]['rentaamort']+'</td> <td>'+separadorMiles(dosDecimales(data.flujo[i]['total']))+'</td></tr>');
			}
			
		} catch(err){
			$('#tablaFlujos tr:last').after('<tr><td>'+fechaFormateada(new Date(data.flujo[i]['fecha'].replace(/[#-]/g, "/")))+'</td> <td>'+separadorMiles(dosDecimales(data.flujo[i]['vr']))+'</td> <td>'+separadorMiles(dosDecimales(data.flujo[i]['renta']))+'</td> <td>'+separadorMiles(dosDecimales(data.flujo[i]['amort']))+'</td> <td>'+data.flujo[i]['rentaamort']+'</td> <td>'+separadorMiles(dosDecimales(data.flujo[i]['total']))+'</td></tr>');
		}
		
	};
}


function bloqueCotizaciones(data){
    $("#tablaByma").find("tr:gt(0)").remove();
    $("#tablaMae").find("tr:gt(0)").remove();
    
	for(i=0;i<data.byma.length;i++){		
		$('#tablaByma tr:last').after('<tr><td>'+fechaFormateada(new Date(data.byma[i]['fecha'].replace(/[#-]/g, "/")))+'</td> <td>'+data.byma[i]['moneda']+'</td> <td>'+data.byma[i]['plazo']+'</td> <td style="text-align:right;" >'+separadorMiles(dosDecimales(data.byma[i]['precio']))+'</td> <td style="text-align:right;">'+separadorMiles(data.byma[i]['cantidad'])+'</td> </tr>');
	};
	
	for(i=0;i<data.mae.length;i++){		
		$('#tablaMae tr:last').after('<tr><td>'+fechaFormateada(new Date(data.mae[i]['fecha'].replace(/[#-]/g, "/")))+'</td> <td>'+data.mae[i]['moneda']+'</td> <td>'+data.mae[i]['plazo']+'</td> <td style="text-align:right;" >'+separadorMiles(dosDecimales(data.mae[i]['precio']))+'</td> <td style="text-align:right;">'+separadorMiles(data.mae[i]['cantidad'])+'</td> </tr>');
	};
}


function bloqueTasasFechasCupones(data){

	try {
		var fechaultCup = new Date(data.flujo[0]['fechaultcupon'].replace(/[#-]/g, "/"));		
		$('#ultCupLab').text(fechaFormateada(fechaultCup));
	} catch(err){
		$('#ultCupLab').text("-");
	}
	
	try {
		var fechaTasa = new Date(data.flujo[0]['fechauno'].replace(/[#-]/g, "/"));	
		
		$('#labelStart').text('Start:  ' + fechaFormateada(fechaTasa));
		
		fechaTasa = new Date(data.flujo[0]['fechados'].replace(/[#-]/g, "/"));
		$('#labelEnd').text('End:  ' + fechaFormateada(fechaTasa));
	} catch(err){
		$('#labelStart').text("-");
		$('#labelEnd').text("-");
	}
	
	try {
		var fechaProxCup = new Date(data.flujo[0]['fechaproxcupon'].replace(/[#-]/g, "/"));	
		$('#proxCupLab').text(fechaFormateada(fechaProxCup));
		$('#HproxCup').text(fechaFormateada(fechaProxCup));
	} catch(err){
		$('#proxCupLab').text("-");
		$('#HproxCup').text('Prox. Cupón');
	}
		
	//promult5tasa -- RESTO DE LOS CUPONES.
	$('#badlarRestCupLab').val(dosDecimales(data.flujo[0]['promult5tasa']));
	
	//PROX CUPON  promediotasaproxcupon
	$('#badlarProxCup').val(dosDecimales(data.flujo[0]['promediotasaproxcupon']));

	//prox cup pond				
	$('#badlarProxCupPondLab').val(dosDecimales(data.proxCupPond[0]['tasa']));
	
	$('#badlarProxCupLab').val($('#badlarProxCup').val());
	
	$('#badlarProxCupLab').attr('readonly', true);
	$('#badlarRestCupLab').attr('readonly', true);
	$('#tasaVarSel').val('Proy. Mercado');
	
}

function calcularPrecioConCambio(){
	var tipoCambio = getTipoCambio();
	var TotalMonedaCash = $('#TotalRentTenenciaLab1').val();
	
	if($('#monedaPrecioTirLab').text() != 'Precio en AR$:'){
		if(tipoCambio != ''){
			TotalMonedaCash = TotalMonedaCash * tipoCambio;
			$('#TotalRentTenenciaLab2').text(separadorMiles(dosDecimales(TotalMonedaCash)));
		} else {
			$('#TotalRentTenenciaLab2').text('-');
		}		
	}
}

function obtenerMonedaCash(){
	var monedaCash;
	
	if($('#monedaPrecioTirLab').text() == 'Precio en AR$:'){
		monedaCash = 'Pesos';
	} else if ($('#monedaPrecioTirLab').text() == 'Precio en U$D:') {
		monedaCash = 'Dolares';
	} else if ($('#monedaPrecioTirLab').text() == 'Precio en Eu$:') {
		monedaCash = 'Euros';
	} else if ($('#monedaPrecioTirLab').text() == 'Precio en Uv$:') {
		monedaCash = 'Uvas';
	} else if ($('#monedaPrecioTirLab').text() == 'Precio en Ch$:') {
		monedaCash = 'Pesos Chilenos';
	}
	
	return monedaCash;
}


function obteneFlujosIndicadoresProxCupon(prox, ind, fluj, plazo){
	
	
	var ticker = $('#selecTicker').val();
	var fechaLiquidacion;
	if (plazo == 'x' || plazo == 'y'){
		fechaLiquidacion =  $('#fechaLiqinp').val();
	} else {
		fechaLiquidacion =  $('#fechaHoyinp').val();
	}
		
	
	var precio = getPrecio();	
	var tipoCambio = getTipoCambio();	
	var moneda = $('#tipoMonedaSel').val();
	var tipoPrecio = $('#tipoPrecioSel').val();
	
	var proxCup = getTasaProxCup();
	var restCup = getTasaRestCup();
	var nominales = $('#cantidadNomInp').val();
	
	if((ticker != '' && ticker != null) && fechaLiquidacion != ''){		
		$.get("/calculadoraDeBonos/flujoIndicadores/"+ticker+"/"+fechaLiquidacion+"/"+precio+"/"+tipoPrecio+"/"+moneda+"/"+tipoCambio+"/"+proxCup+"/"+restCup+"/"+getDolarFut()+"/"+plazo+"/"+nominales , null ,function(data, status){
			data = $.parseJSON(JSON.stringify(data));
			var valida = validarAutorizacion(data);
			if(valida == 'ok') {
				
				if ($('#valorEmiLab').text() != '-'){
					$('#valCerCalcLab').text(separadorMiles(dosDecimales(data.flujo[0]['ceru'])));
				}
						
				if(fluj == 's'){
					bloqueFlujos(data);
				}
				
				if(ind == 's'){
					bloqueIndicadores(data);
				}
				
				if(prox == 's'){
					bloqueProxCupon(data);
				}
				
				if (plazo != 'x' ){
					bloqueTasasFechasCupones(data);
				}
				
				actualizarValuacionCartera();
				
				var tir = $('#tirReqInp').val();
				if(tir != null && tir != ''){			   
					actualizarTirSpreadReq(tir);
				}
				
			}
		});
	}
	
	$('#nav-DescTec-tab').trigger('click');
}


function obtenerFechaPlazo(){
	var fech = $('#fechaHoyinp').val();
	var plazo = $('#fechainp').val();
	
	$.get("/calculadoraDeBonos/fechaPlazo/"+fech+"/"+plazo , null ,function(data, status){
		
		data = $.parseJSON(JSON.stringify(data));		
		var valida = validarAutorizacion(data);
		if(valida == 'ok') {
		   $('#fechaLiqinp').val(data.Fecha[0]['fechareturn']);
		   $('#TipoCambioInp').val(seisDecimales(data.cambio[0]['cotizacion']));
		}		
	});	
		
};

function cambiarLabelCleanDirty(){
	if($('#tipoPrecioSel').val() == 'Clean'){
		$('#cleanDerLib').text('Dirty');		
	} else {
		$('#cleanDerLib').text('Clean');		
	}	
}

function cambioTipoMoneda(){
	if( $("#tipoMonedaSel").val() != 'Pesos'){
		$('#cleanDerPesosDiv').show();
	} else {
		$('#cleanDerPesosDiv').hide();
	}
}

function solodosDecimales(cadena){
	var carac;
	var posiDesi;
	var res;
	for(i=0; i<cadena.length; i++){
		carac = cadena.charAt(i)
		if (carac == '.' || carac == ','){
			posiDesi = (i+1);
			break;
		}		
	}
	
	if(cadena.length > (posiDesi + 3)){
		res = cadena.substring(0, (posiDesi + 3));
	} else {
		res = cadena;
	}
	return res;
}

function soloSeisDecimales(cadena){
	var carac;
	var posiDesi;
	var res;
	for(i=0; i<cadena.length; i++){
		carac = cadena.charAt(i)
		if (carac == '.' || carac == ','){
			posiDesi = (i+1);
			break;
		}		
	}
	
	if(cadena.length > (posiDesi + 6)){
		res = cadena.substring(0, (posiDesi + 6));
	} else {
		res = cadena;
	}
	return res;
}

function fechaFormateada(now){
	 var day = ("0" + (now.getDate()) ).slice(-2);
	 var month = ("0" + (now.getMonth() + 1)).slice(-2);
	 var today = (day)+"/"+(month)+"/"+now.getFullYear();
	    
	 return today;
}


function cargarDatosBono(valTicker){
	$('#PrecioInp').val('');	
	$('#tipoPrecioSel').val('Dirty');
	
	cargaInicial(0);
	
	
	var fech = $('#fechaHoyinp').val();
	var plazo = $('#fechainp').val();
	
	var fin = 0;
	
	$.get("/calculadoraDeBonos/fechaPlazo/"+fech+"/"+plazo , null ,function(data, status){
		
		data = $.parseJSON(JSON.stringify(data));		
		var valida = validarAutorizacion(data);
		if(valida == 'ok') {
		   $('#fechaLiqinp').val(data.Fecha[0]['fechareturn']);
		   $('#TipoCambioInp').val(seisDecimales(data.cambio[0]['cotizacion']));		
		}

		
		var fech = $('#fechaLiqinp').val();
		document.title = 'Calculadora Bonos - ' + valTicker;
	
		$.get("/calculadoraDeBonos/datosBono/"+valTicker+"/"+fech , null ,function(data, status){
			
			data = $.parseJSON(JSON.stringify(data));
			var valida = validarAutorizacion(data);
			if(valida == 'ok') {
				var moneda = data.bonoCondiciones[0]['monedaemision'];
				
				try{
					$('#TipoCambioInp').val(seisDecimales(data.cambio[0]['cotizacion']));
				}catch{}
				
				if (moneda=='D'){
					moneda = 'Dolares';				
				} else if (moneda=='P'){
					moneda = 'Pesos';
				}  else if (moneda=='E'){
					moneda = 'Euros';
				}  else if (moneda=='U'){
					moneda = 'Uvas';
				}  else if (moneda=='C'){
					moneda = 'Pesos Chilenos';
				} 
				
				$('#cantidadNomInp').val('100');
				var pesifica = data.bonoCondiciones[0]['pesifica'];
				
				if(moneda != 'Pesos' && pesifica == 'N'){
								
					$('#tipoMonedaSel').val(moneda);
								
					if(moneda == 'Dolares'){
						$('#monedaPrecioTirLab').text('Precio en U$D:');
						$('#capitalMonedaLab').text('Valuación Tecnica U$D:');
						$('#tenenciaValLab').text('Tenencia Valorizada (U$D)');
					} else if(moneda == 'Euros'){
						$('#monedaPrecioTirLab').text('Precio en Eu$:');
						$('#capitalMonedaLab').text('Valuación Tecnica Eu$:');
						$('#tenenciaValLab').text('Tenencia Valorizada (Eu$)');
					} else if(moneda == 'Uvas'){
						$('#monedaPrecioTirLab').text('Precio en Uv$:');
						$('#capitalMonedaLab').text('Valuación Tecnica Uv$:');
						$('#tenenciaValLab').text('Tenencia Valorizada (Uv$)');
					} else if(moneda == 'Pesos Chilenos'){
						$('#monedaPrecioTirLab').text('Precio en Ch$:');
						$('#capitalMonedaLab').text('Valuación Tecnica Ch$:');
						$('#tenenciaValLab').text('Tenencia Valorizada (Ch$)');
					}
					
					$('#tenValPesLab').text('Tenencia Valorizada (AR$)');			
			
									
					$('#tenenciaValRow').show();
				} else {
					$('#tipoMonedaSel').val('Pesos');
					
					
					$('#monedaPrecioTirLab').text('Precio en AR$:');
					$('#capitalMonedaLab').text('Valuación Tecnica AR$:');
					$('#tenenciaValLab').text('Tenencia Valorizada (AR$)');
					$('#tenenciaValRow').hide();
				}
				
				$('#monedaEmLab').text(moneda);			
				$('#descBonoH').text(data.bonoCondiciones[0]['descripcion']);
		
				var fechaEmi = new Date(data.bonoCondiciones[0]['fechaemision'].replace(/[#-]/g, "/"));		 
				$('#fechaEmiLab').text(fechaFormateada(fechaEmi));
							
				var fechaVenc = new Date(data.bonoCondiciones[0]['fechavencimiento'].replace(/[#-]/g, "/"));		 
				$('#fechaVencLab').text(fechaFormateada(fechaVenc));
				
				var frecuencia = data.bonoCondiciones[0]['frecuencia'];
				$('#frecAnualLab').text(frecuencia);
				
				var call = data.bonoCondiciones[0]['call'];
				
				if (call == 'S') {
					if(data.bonoCondiciones[0]['tasa'] == 'L'){		
						var tss = data.bonoCondiciones[0]['margencall'];
						tss= tss * 100;
						$('#callTitLab').text('Call Libor + ' + tss + ' pb a partir del:');				
					} else {
						$('#callTitLab').text('Call al + ' + (data.bonoCondiciones[0]['margencall'])+ ' %');
						
					}
					var fcall = data.bonoCondiciones[0]['fechacall'];
					if(fcall != null){
						var fechaTasa = new Date(data.bonoCondiciones[0]['fechacall'].replace(/[#-]/g, "/"));
						$('#callLab').text(fechaFormateada(fechaTasa));
					} else {
						$('#callLab').text('-');
					}
					
				} else {			
					$('#callTitLab').text('Call');
					$('#callLab').text('No');
				};
				
				$('#tasaMaxLab').text(dosDecimales(data.bonoCondiciones[0]['tasacup']) + '%');
				$('#tasMinLab').text('% ( 0 Primeros cupones)');
									
				$('#monNomVigLab').text('$ '+separadorMiles(dosDecimales(data.bonoCondiciones[0]['montoemision'])));
				
				var baseCalc = data.bonoCondiciones[0]['base'];
				if (baseCalc == '0'){
					baseCalc = '30/360';
				} else if (baseCalc == '1'){
					baseCalc = 'real/real';
				} else if (baseCalc == '2'){
					baseCalc = 'real/360';
				} else {
					baseCalc = 'real/365';
				}
				$('#baseCalcLab').text(baseCalc);
				
				try{
					if(data.bonoCondiciones[0]['tipodecambioemision'] > 1){
						$('#diasHabPrevTitLab').text('Tipo de Cambio Inicial');
						$('#diasHabPrevLab').text(dosDecimales(data.bonoCondiciones[0]['tipodecambioemision']));						
					} else {
						$('#diasHabPrevTitLab').text('Días hábiles previos al cúpon para cálculo de ajuste');
						$('#diasHabPrevLab').text(data.bonoCondiciones[0]['diasantescer']);
					}
				} catch(error){
					$('#diasHabPrevTitLab').text('Días hábiles previos al cúpon para cálculo de ajuste');
					$('#diasHabPrevLab').text(data.bonoCondiciones[0]['diasantescer']);
				}
											
				if((data.bonoCondiciones[0]['ajustacer'] == 'S') || (data.bonoCondiciones[0]['ajustauva'] == 'S')){
					try{
						if((data.bonoCondiciones[0]['ajustacer'] == 'S')){
							$('#ajustaPorLab').text('CER');
							$('#valorEmiLab').text(separadorMiles(dosDecimales(data.bonoCondiciones[0]['ceremision'])));						
						} else {
							$('#ajustaPorLab').text('UVA');
							$('#valorEmiLab').text(separadorMiles(dosDecimales(data.bonoCondiciones[0]['uvaemision']))); 
						}
					}catch{}
				} else {
					$('#ajustaPorLab').text('-');
					$('#valorEmiLab').text('-');
					$('#valCerCalcLab').text('-');
				}
				
				var tipoCup = data.bonoCondiciones[0]['tipocupon'];
				
				$('#badlarRestCupLab').val('');
				
				//LIMPIO TASAS ANTES DE CARGAR
				$('#badlarProxCup').val('');					
				$('#badlarProxCupPondLab').val('');			
				$('#badlarProxCupLab').val('');	
				
				
				if(tipoCup == 'B' ||  tipoCup == 'T' || tipoCup == 'P' || tipoCup == 'L' || tipoCup == 'G'  ){
									
					if (frecuencia != 4){
						$('#spreadTrim').show();
						$('#spreadOTir').css('margin-top','0px');
					} else {
						$('#spreadTrim').hide();
						$('#spreadOTir').css('margin-top','20px');
					}
					
					$('#spreadFila').show();
					$('#spreadFila').css('background','#f3f3f3');
					$('#currentFila').css('background','#fff');		
					
					
					if(tipoCup == 'B'){
						$('#tipoCuponLab').text('Badlar');
					} else if(tipoCup == 'T'){
						$('#tipoCuponLab').text('TAMAR');
					} else if(tipoCup == 'P'){
						$('#tipoCuponLab').text('Politica Monetaria');
					} else if(tipoCup == 'L'){
						$('#tipoCuponLab').text('Libor');
					} else if(tipoCup == 'G'){
						$('#tipoCuponLab').text('PASIVOS BCRA 7 DIAS');
					}
					$('.columnaTasaVar').show();
					
					//promult5tasa -- RESTO DE LOS CUPONES.
					$('#badlarRestCupLab').val(dosDecimales(data.flujo[0]['promult5tasa']));
					
					//PROX CUPON  promediotasaproxcupon
					$('#badlarProxCup').val(dosDecimales(data.flujo[0]['promediotasaproxcupon']));
				
					//prox cup pond				
					$('#badlarProxCupPondLab').val(dosDecimales(data.proxCupPond[0]['tasa']));
					
					$('#badlarProxCupLab').val($('#badlarProxCup').val());	
					
					$('#tasaVarProxCupLab').text($('#tipoCuponLab').text() + ' Prox Cupón');
					$('#tasaVarRestCupLab').text($('#tipoCuponLab').text() + '  Resto Cupones');
					
					$('#tirCard').text('Spread Requerido');
					$('#tirReqInp').attr('placeholder','Spread Requerido');
					
					$('.columnaTasaVar').show();
					$('#cardMedidasRent').css('min-height','375px');
					
					
					
					$('#sensibilidadTirSpreadH').text('Sensibilidad Spread');
					$('#variacionTirSpreadLabel').text('Variación Spread:');				
					$('#columnaSpreadTirMercado').text('Spread S/Tasa Ref');				
					$('#tirSpreadSensColumna').text('Spread');
					
					$('#badlarProxCupLab').attr('readonly', true);
					$('#badlarRestCupLab').attr('readonly', true);
					$('#tasaVarSel').val('Proy. Mercado');
									
				}else{
					$('.columnaTasaVar').hide();
					$('#cardMedidasRent').css('min-height','315px');
					
					$('#spreadTrim').hide();				
					$('#spreadOTir').css('margin-top','20px');
					$('#tirCard').text('TIR Requerida');
					$('#tirReqInp').attr('placeholder','TIR Requerida');
									
					$('#spreadFila').hide();
					$('#spreadFila').css('background','#fff');
					$('#currentFila').css('background','#f3f3f3');
					
					$('#sensibilidadTirSpreadH').text('Sensibilidad de TIR');
					$('#variacionTirSpreadLabel').text('Variación TIR:');
					$('#columnaSpreadTirMercado').text('TIR S/Tasa Ref');
					$('#tirSpreadSensColumna').text('TIR Efectiva');
					
				}
				
				var tipoBono = data.bonoCondiciones[0]['tipobono'];
				
				if(tipoBono == 'L' || tipoBono == 'D' || tipoBono == 'E' || tipoBono == 'T'){
					$('#tirCard').text('TNA Requerida');
					$('#tirReqInp').attr('placeholder','TNA Requerida');
				}
							
				$('#tirReqInp').val('');
				$('#spreadTrimReqInp').val('');
				
				
				$('#capitalLab').text('');
				$('#tenValDolLab').text('');
				$('#tenValPesosLab').text('');
				$('#precioTirLab').text('');	
				$('#precioSpreadTrimLab').text('');			
				
				try {
					var fechaultCup = new Date(data.flujo[0]['fechaultcupon'].replace(/[#-]/g, "/"));		
					$('#ultCupLab').text(fechaFormateada(fechaultCup));
				} catch(err){
					$('#ultCupLab').text("-");
				}
				
				try {
					var fechaProxCup = new Date(data.flujo[0]['fechaproxcupon'].replace(/[#-]/g, "/"));	
					$('#proxCupLab').text(fechaFormateada(fechaProxCup));
					$('#HproxCup').text(fechaFormateada(fechaProxCup));
				} catch(err){
					$('#proxCupLab').text("-");
					$('#HproxCup').text('Prox. Cupón');
				}
				
				
				try {
					var fechaTasa = new Date(data.flujo[0]['fechauno'].replace(/[#-]/g, "/"));	
					
					$('#labelStart').text('Start:  ' + fechaFormateada(fechaTasa));
					
					fechaTasa = new Date(data.flujo[0]['fechados'].replace(/[#-]/g, "/"));
					$('#labelEnd').text('End:  ' + fechaFormateada(fechaTasa));
				} catch(err){
					$('#labelStart').text("-");
					$('#labelEnd').text("-");
				}
				
				
				
				
				
				$('#tituloMercadoH').text(data.bonoCondiciones[0]['codigoespecie'] + ' - ' + data.bonoCondiciones[0]['descripcion']);
				
				if (tipoBono == 'L'  || tipoBono == 'D' || tipoBono == 'E'){
					$('#tablaAnalisisMerc').hide();				
					$('#tablaAnalisisMercBD').show();			
				} else{
					$('#tablaAnalisisMerc').show();				
					$('#tablaAnalisisMercBD').hide();				
				}
				
				
				try{
					$('#PrecioInp').val(seisDecimales(data.precio[0]['precio']));				
					$('#tipoPrecioSel').val(data.precio[0]['tipocotizacion']);
					$('#tipoMonedaSel').val(data.precio[0]['tipomoneda']);
					$('#TipoCambioInp').val(seisDecimales(data.precio[0]['tipodecambio']));
				} catch{}
				
				/* BONOS BIS BEGIN
					try{
						var bonobis = data.bonoCondiciones[0]['bonobis'];
						
						if(bonobis == 'C'){
							$('#dolarFutDiv').show();
							try{
								$('#DolarFutInp').val(dosDecimales(data.flujo[0]['dolarfut']));
							} catch(err){
								$('#DolarFutInp').val("");
							}
						} else{
							$('#dolarFutDiv').hide();
							$('#DolarFutInp').val("");
						}
						
					}catch{
						$('#dolarFutDiv').hide();
						$('#DolarFutInp').val("");
					} 
				BONOS BIS END*/
				try{
					
					if(tipoCup == 'C'){
						$('#dolarFutDiv').show();
						try{
							$('#DolarFutInp').val("");
						} catch(err){
							$('#DolarFutInp').val("");
						}
					} else{
						$('#dolarFutDiv').hide();
						$('#DolarFutInp').val("");
					}
					
				}catch{
					$('#dolarFutDiv').hide();
					$('#DolarFutInp').val("");
				}
				
				obteneFlujosIndicadoresProxCupon('s','s','s','x');
								
				bloqueCotizaciones(data);
				
				
				$('#variacionPrecioInp').val('');
				$('#variacionCambioInp').val('');
				$('#variacionTirInp').val('');
				$("#tablaSensPrecio").find("tr:gt(0)").remove();
				$("#tablaSensCambio").find("tr:gt(0)").remove();
				$("#tablaSensTir").find("tr:gt(0)").remove();
				
				
				
				
			}
		});
	
	});
}

function cargaInicial(i){
	var now = new Date();
	 
    var day = ("0" + (now.getDate()) ).slice(-2);
    var month = ("0" + (now.getMonth() + 1)).slice(-2);
    var today = now.getFullYear()+"-"+(month)+"-"+(day) ;
       
   $('#fechaHoyinp').val(today);
   $('#fechainp').val('T+1');
   
   if(i == 1){
	   obtenerFechaPlazo(); 
   }
   
}

	
function cargarTickers(){	 

	$.get("/calculadoraDeBonos/tickers", null ,function(data, status){
		data = $.parseJSON(JSON.stringify(data));
		var valida = validarAutorizacion(data);
		if(valida == 'ok') {
			
			$("#selecTicker").html('<option value="" disabled selected>Ingrese Ticker</option>');
			
			for(i=0;i<data.tickers.length;i++){				
				$("#selecTicker").append(new Option(data.tickers[i]['codigoespecie'], data.tickers[i]['codigoespecie']));
			};
			
			validarSeleccionoConsulta();
		}
	});	
};

function buscarBono(){
		
	var consulta = $('#buscarBono').val();	
	var sinResultado = true;	
			
	if(consulta.length > 0) {
		$.get("/calculadoraDeBonos/buscarBono/"+consulta+"/c", null ,function(data, status){
			data = $.parseJSON(JSON.stringify(data));	
			var valida = validarAutorizacion(data);
			if(valida == 'ok') {
				if(data.bonosDescripcion.length >= 1){
					sinResultado = false;
					$("#selecBonoDesc").find('option').remove().end();	
					var placehold = new Option("Haga Click para ver resultados de busqueda");
					placehold.setAttribute("selected","selected");
					placehold.setAttribute("disabled","disabled");
					$("#selecBonoDesc").append(placehold);	
				}
				for(i=0;i<data.bonosDescripcion.length;i++){
					var o = new Option(data.bonosDescripcion[i]['concatenado'], data.bonosDescripcion[i]['ticker']);				
					$("#selecBonoDesc").append( o   );
				
				};
				
				if(!sinResultado){
					$('#selecBonoDesc').focus();
				}
			}
		});
	}
		
	if (sinResultado){
		limpiarBusquedaBono();
	}
	
};

function limpiarBusquedaBono(){
	$("#selecBonoDesc").find('option').remove().end();	
	var placehold = new Option("Resultado de Búsqueda");
	placehold.setAttribute("selected","selected");
	placehold.setAttribute("disabled","disabled");
	$("#selecBonoDesc").append(placehold);	
}

function validarAutorizacion(data){
	try{
		var k = data['sinAutorizacion'];
		
		if (k != null){
			var red;
			if (k == 'sesionFinalizada'){
				red = '/calculadoraDeBonos/loginE';
			} else {
				red = '/calculadoraDeBonos/login';
			}	
			
			location.replace(red);
			return 'false';
		}
	} catch{
		
	}
	
	return 'ok';
}

//METODOS QUE NO VAN
function enviarJson(){
	 jsonObj = [];
	item = {};
       item ["title"] = 'titulo';
       item ["val"] = 'valor';

       jsonObj.push(item);
		
		var jsonString = JSON.stringify(jsonObj);
		
		alert(jsonString);
};