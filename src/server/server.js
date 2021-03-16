import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import * as Yup from 'yup';
import User from './schemas/model.user';
import {spicSchema} from './schemas/model.s2';
import {ssancionadosSchema} from './schemas/model.s3s';
import {psancionadosSchema} from './schemas/model.s3p';
import Provider from './schemas/model.proovedor';
import Catalog from './schemas/model.catalog';
import Bitacora from './schemas/model.bitacora';
import moment from "moment";
const mongoose = require('mongoose');
const yaml = require('js-yaml')
const fs = require('fs');
const SwaggerClient = require('swagger-client');
var Validator = require('swagger-model-validator');
var validator = new Validator(SwaggerClient);
var swaggerValidator = require('swagger-object-validator');
var _ = require('underscore');
var jwt = require('jsonwebtoken');
import regeneratorRuntime from "regenerator-runtime";
import * as Console from "console";
import { SMTPClient } from 'emailjs';
import {forEach} from "underscore";


//connection mongo db
console.log('mongodb://'+process.env.USERMONGO+':'+process.env.PASSWORDMONGO+'@'+process.env.HOSTMONGO+'/'+process.env.DATABASE);
const db = mongoose.connect('mongodb://'+process.env.USERMONGO+':'+process.env.PASSWORDMONGO+'@'+process.env.HOSTMONGO+'/'+process.env.DATABASE, { useNewUrlParser: true,  useUnifiedTopology: true  })
    .then(() => console.log('Connect to MongoDB..'))
    .catch(err => console.error('Could not connect to MongoDB..', err))

mongoose.set('useFindAndModify', false);

let S2 = mongoose.connection.useDb("S2");
let S3S = mongoose.connection.useDb("S3_Servidores");
let S3P =mongoose.connection.useDb("S3_Particulares");
//let port = process.env.PORT || 7777;
let app = express();
app.use(
    cors(),
    bodyParser.urlencoded({extended:true}),
    bodyParser.json()
);


let server = app.listen(3004, function () {
    let host = server.address().address;
    let port = server.address().port;
    console.log(' function cloud Server is listening at http://%s:%s', host, port);
});


function getArrayFormatTipoProcedimiento(array){
    _.each(array, function(p){
        p.clave = parseInt(p.clave);
    });
    return array;
}

var validateToken = function(req){
    var inToken = null;
    var auth = req.headers['authorization'];

    if (auth && auth.toLowerCase().indexOf('bearer') == 0) {
        inToken = auth.slice('bearer '.length);
    } else if (req.body && req.body.access_token) {
        inToken = req.body.access_token;
    } else if (req.query && req.query.access_token) {
        inToken = req.query.access_token;
    }
    // invalid token - synchronous
    try {
        var decoded =  jwt.verify(inToken, process.env.SEED );
        return {code: 200, message: decoded};
    } catch(err) {
        // err
        let error="" ;
        if (err.message === "jwt must be provided"){
            error = "Error el token de autenticación (JWT) es requerido en el header, favor de verificar"
        }else if(err.message === "invalid signature" || err.message.includes("Unexpected token")){
            error = "Error token inválido, el token probablemente ha sido modificado favor de verificar"
        }else if (err.message ==="jwt expired"){
            error = "Error el token de autenticación (JWT) ha expirado, favor de enviar uno válido "
        }else {
            error = err.message;
        }

        let obj = {code: 401, message: error};
        return obj;
    }
}


const esquemaS3 =Yup.object().shape({
    expediente: Yup.string().matches(new RegExp('^[A-zÀ-ú-0-9 ]{1,25}$'),'No se permiten cadenas vacías, máximo 25 caracteres').trim(),
    idnombre:Yup.string().matches(new RegExp('^[A-zÀ-ú-0-9_\.\' ]{1,50}$'),'No se permiten cadenas vacías, máximo 50 caracteres').required("El campo Nombres de la sección Institución Dependencia es requerido").trim(),
    idsiglas: Yup.string().matches(new RegExp('^[A-zÀ-ú-0-9_\.\' ]{1,25}$'),'No se permiten cadenas vacías, máximo 25 caracteres ').trim(),
    idclave: Yup.string().matches(new RegExp('^[A-zÀ-ú-0-9_\.\' ]{1,25}$'),'No se permiten cadenas vacías, máximo 25 caracteres').trim(),
    SPSnombres:Yup.string().matches(new RegExp("^['A-zÀ-ú-\. ]{1,25}$"),'No se permiten números, ni cadenas vacías máximo 25 caracteres ' ).required("El campo Nombres de Servidor público es requerido").trim(),
    SPSprimerApellido: Yup.string().matches(new RegExp("^['A-zÀ-ú-\. ]{1,25}$"),'No se permiten números, ni cadenas vacías máximo 25 caracteres').required("El campo Primer apellido de Servidor público es requerido").trim(),
    SPSsegundoApellido: Yup.string().matches(new RegExp("^['A-zÀ-ú-\. ]{1,25}$"),'No se permiten números, ni cadenas vacías máximo 25 caracteres').trim(),
    SPSgenero : Yup.object(),
    SPSpuesto:Yup.string().matches(new RegExp("^['A-zÀ-ú-\. ]{1,25}$"),'No se permiten números, ni cadenas vacías máximo 25 caracteres').required("El campo Puesto de Servidor público es requerido").trim(),
    SPSnivel:Yup.string().matches(new RegExp('^[A-zÀ-ú-0-9_\.\' ]{1,25}$'),'No se cadenas vacías, máximo 25 caracteres').trim(),
    autoridadSancionadora:Yup.string().matches(new RegExp("^['A-zÀ-ú-\. ]{1,25}$"),'No se permiten números, ni cadenas vacías máximo 25 caracteres').trim(),
    tipoFalta: Yup.object(),
    tpfdescripcion: Yup.string().matches(new RegExp('^[A-zÀ-ú-0-9 ]{1,50}$'),'No se permiten cadenas vacías, máximo 50 caracteres').trim(),
    tipoSancion: Yup.array().min(1).required("Se requiere seleccionar mínimo una opción del campo Tipo sanción"),
    tsdescripcion:Yup.string().matches(new RegExp('^[A-zÀ-ú-0-9 ]{1,50}$'),'No se permiten cadenas vacías, máximo 50 caracteres').trim(),
    causaMotivoHechos:  Yup.string().matches(new RegExp('^[A-zÀ-ú-0-9 ]{1,500}$'),'No se permiten cadenas vacías, máximo 500 caracteres').required("El campo Causa o motivo de la sanción es requerido").trim(),
    resolucionURL: Yup.string()
        .matches(/((https?):\/\/)?(www.)?[a-z0-9]+(\.[a-z]{2,}){1,3}(#?\/?[a-zA-Z0-9#]+)*\/?(\?[a-zA-Z0-9-_]+=[a-zA-Z0-9-%]+&?)?$/,
            'Introduce una direccion de internet valida'
        ),
    resolucionFecha:  Yup.string().required("El campo Fecha de resolución es requerido"),
    multaMonto: Yup.string().matches(new RegExp("^([0-9]*[.])?[0-9]+$"),'Solo se permiten números enteros o decimales').required("El campo Monto es requerido"),
    multaMoneda: Yup.object().required("El campo Moneda es requerido"),
    inhabilitacionPlazo:Yup.string().matches(new RegExp('^[A-zÀ-ú-0-9 ]*$'),'No se permiten cadenas vacías').trim(),
    inhabilitacionFechaInicial:  Yup.string().required("El campo Fecha inicial de la sección  es requerido"),
    inhabilitacionFechaFinal:  Yup.string().required("El campo Fecha final de la sección  es requerido"),
    observaciones: Yup.string().matches(new RegExp('^[A-zÀ-ú-0-9 ]{1,500}$'),'No se permiten cadenas vacías, máximo 500 caracteres').trim(),
    documents: Yup.array().of(
        Yup.object().shape({
            docId: Yup.string(),
            titulo: Yup.string().required('El campo Título de la sección Documentos es requerido ').max(50, 'Máximo 50 caracteres'),
            descripcion: Yup.string().required('El campo Descripción de la sección Documentos es requerido ').max(200, 'Máximo 200 caracteres'),
            url: Yup.string()
                .matches(/((https?):\/\/)?(www.)?[a-z0-9]+(\.[a-z]{2,}){1,3}(#?\/?[a-zA-Z0-9#]+)*\/?(\?[a-zA-Z0-9-_]+=[a-zA-Z0-9-%]+&?)?$/,
                    'Introduce una direccion de internet valida'
                )
                .required('El campo URL de la sección Documentos es requerido'),
            fecha: Yup.string().required("El campo Fecha de la sección Documentos es requerido"),
            tipoDoc: Yup.object()
        })
    )
});

const esquemaS2=  Yup.object().shape({
    ejercicioFiscal: Yup.string().matches(new RegExp('^[0-9]{4}$'),'Debe tener 4 dígitos'),
    ramo: Yup.string(),
    nombres : Yup.string().matches(new RegExp("^['A-zÀ-ú-\. ]{1,25}$"),'no se permiten números, ni cadenas vacias ' ).required().trim(),
    primerApellido : Yup.string().matches(new RegExp("^['A-zÀ-ú-\. ]{1,25}$"),'no se permiten números, ni cadenas vacias ' ).required().trim(),
    segundoApellido :Yup.string().matches(new RegExp("^['A-zÀ-ú-\. ]{1,25}$"),'no se permiten números, ni cadenas vacias ' ).trim(),
    genero : Yup.object(),
    idnombre:Yup.string().matches(new RegExp('^[A-zÀ-ú-0-9_\.\' ]{1,50}$'),'no se permiten cadenas vacias , max 50 caracteres ').required().trim(),
    idsiglas: Yup.string().matches(new RegExp('^[A-zÀ-ú-0-9_\.\' ]{1,50}$'),'no se permiten cadenas vacias , max 50 caracteres ').trim(),
    idclave: Yup.string().matches(new RegExp('^[A-zÀ-ú-0-9_\.\' ]{1,50}$'),'no se permiten cadenas vacias , max 50 caracteres ').trim(),
    puestoNombre: Yup.string().matches(new RegExp("^['A-zÀ-ú-\. ]{1,25}$"),'no se permiten números, ni cadenas vacias ' ).trim()
        .when('puestoNivel',  (puestoNivel) => {
            if(!puestoNivel)
                return Yup.string().matches(new RegExp("^['A-zÀ-ú-\. ]{1,25}$"),'no se permiten números, ni cadenas vacias, max 25 caracteres ' ).trim().required("Al menos un campo seccion Puesto, es requerido ")
        }),
    puestoNivel :Yup.string().matches(new RegExp("^[a-zA-Z0-9 ]{1,25}$"),'no se permiten números, ni cadenas vacias ' ).trim(),
    tipoArea: Yup.array(),
    nivelResponsabilidad : Yup.array(),
    tipoProcedimiento :Yup.array().min(1).required(),
    sinombres: Yup.string().matches(new RegExp("^['A-zÀ-ú-\. ]{1,25}$"),'no se permiten números, ni cadenas vacias, max 25 caracteres ' ).trim() ,
    siPrimerApellido: Yup.string().matches(new RegExp("^['A-zÀ-ú-\. ]{1,25}$"),'no se permiten números, ni cadenas vacias, max 25 caracteres ' ).trim() ,
    siSegundoApellido:Yup.string().matches(new RegExp("^['A-zÀ-ú-\. ]{1,25}$"),'no se permiten números, ni cadenas vacias, max 25 caracteres ' ).trim() ,
    siPuestoNombre: Yup.string().matches(new RegExp("^['A-zÀ-ú-\. ]{1,25}$"),'no se permiten números, ni cadenas vacias, max 25 caracteres ' ).trim(),
    siPuestoNivel: Yup.string().matches(new RegExp("^[a-zA-Z0-9 ]{1,25}$"),'no se permiten números, ni cadenas vacias ' ).trim()
});

const schemaUserCreate = Yup.object().shape({
    vigenciaContrasena:  Yup.string().required(),
    fechaAlta:  Yup.string().required(),
});

const schemaUser = Yup.object().shape({
    nombre: Yup.string().matches(new RegExp("^['A-zÀ-ú ]*$"),'no se permiten números, ni cadenas vacias' ).required("El campo nombre es requerido").trim(),
    apellidoUno: Yup.string().matches(new RegExp('^[\'A-zÀ-ú ]*$'),'no se permiten números, ni cadenas vacias' ).required("El campo Primer apellido es requerido").trim(),
    apellidoDos: Yup.string().matches(new RegExp('^[\'A-zÀ-ú ]*$'),'no se permiten números, ni cadenas vacias' ).trim(),
    cargo: Yup.string().matches(new RegExp('^[\'A-zÀ-ú ]*$'),'no se permiten números, ni cadenas vacias' ).required("El campo Cargo es requerido").trim(),
    correoElectronico: Yup.string().required("El campo Correo electrónico es requerido").email(),
    telefono:  Yup.string().matches(new RegExp('^[0-9]{10}$'), 'Inserta un número de teléfono valido, 10 caracteres').required("El campo Número de teléfono es requerido").trim(),
    extension: Yup.string().matches(new RegExp('^[0-9]{0,10}$'), 'Inserta un número de extensión valido , maximo 10 caracteres').trim(),
    usuario: Yup.string().matches(new RegExp('^[a-zA-Z0-9]{8,}$'),'Inserta al menos 8 caracteres, no se permiten caracteres especiales' ).required("El campo Nombre de usuario es requerido").trim(),
    constrasena: Yup.string().matches(new RegExp('^(?=.*[0-9])(?=.*[!@#$%^&*()_+,.\\\\\\/;\':"-]).{8,}$'),'Inserta al menos 8 caracteres, al menos un número, almenos un caracter especial ' ).required("El campo Contraseña es requerido").trim(),
    sistemas: Yup.array().min(1).required("El campo Sistemas aplicables es requerido"),
    proveedorDatos: Yup.string().required("El campo Proveedor de datos es requerido"),
    estatus: Yup.boolean().required("El campo Estatus es requerido")
});



const schemaProvider = Yup.object().shape({
    dependencia:  Yup.string().required().matches(new RegExp('^[ñáéíóúáéíóúÁÉÍÓÚa-zA-Z ]*$'), 'Inserta solamente caracteres'),
    sistemas: Yup.array().min(1).required(),
    estatus: Yup.boolean().required(),
    fechaAlta: Yup.string(),
});

async function registroBitacora(data){
    let response;
    const nuevaBitacora = new Bitacora(data);
    response = await nuevaBitacora.save();
}

async function validateSchema(doc,schema,validacion){
     let result =  await validacion.validateModel(doc, schema);
     if(result){
        let objError={};
        let arrayErrors = result.errorsWithStringTypes();
        let textErrors;
        if(Array.isArray(doc)){
            objError["docId"]= doc[0].id;
        }else{
            console.log("validateSchema docId", doc.id);
            objError["docId"]= doc.id;
        }
        objError["valid"] =  arrayErrors.length === 0 ? true : false;
        objError["errorCount"]= arrayErrors.length;

        let errors= [];
        for(let error of arrayErrors){
            let obj={};
            obj["typeError"]= error.errorType;
            let path = "";
            for(let ruta of error.trace){
                path = path+ ruta.stepName + "/";
            }
            obj["pathError"]= path;
            errors.push(obj);
        }
        objError["errors"]= errors;
        objError["errorsHumanReadable"]= result.humanReadable();
        return objError;
    }
}

app.post('/validateSchemaS2',async (req,res)=>{
    try {
        var code = validateToken(req);
        var usuario=req.headers.usuario;
        if(code.code == 401){
            res.status(401).json({code: '401', message: code.message});
        }else if (code.code == 200 ){
            let fileContents = fs.readFileSync( path.resolve(__dirname, '../src/resource/openapis2.yaml'), 'utf8');
            let data = yaml.safeLoad(fileContents);
            let schemaS2 =  data.components.schemas.respSpic;
            let validacion = new swaggerValidator.Handler();

            let newdocument = req.body;
            let respuesta=[];
            let arrayDocuments=[];
            let ids= [];
            let c1=1;
            if(Array.isArray(newdocument)){
                for (let doc of newdocument){
                    doc["id"]= c1.toString();
                    c1++;
                    respuesta.push(await validateSchema([doc],schemaS2,validacion));
                    ids.push(doc.id);
                    arrayDocuments.push(doc);
                }
            }else{
                newdocument["id"]= c1.toString();
                c1++;
                respuesta.push(await validateSchema([newdocument],schemaS2,validacion));
                arrayDocuments.push(newdocument);
            }

            let wasInvalid;

            for(let val of respuesta){
                if(!val.valid){
                    wasInvalid= true;
                }
            }

            if(wasInvalid){
                res.status(200).json({message : "Error : La validación no fue exitosa" , Status : 500, response : respuesta});
            }else{
                //se insertan
                try {
                    let Spic = S2.model('Spic',spicSchema, 'spic');
                    let response;
                    response = await Spic.insertMany(arrayDocuments);
                    let detailObject= {};
                    detailObject["numeroRegistros"]= arrayDocuments.length;
                    var bitacora=[];
                    bitacora["tipoOperacion"]="CREATE";
                    bitacora["fechaOperacion"]= moment().format();
                    bitacora["usuario"]=usuario;
                    bitacora["numeroRegistros"]=arrayDocuments.length;
                    bitacora["sistema"]="S2";
                    registroBitacora(bitacora);
                    res.status(200).json({message : "Se realizarón las inserciones correctamente", Status : 200 , response: response, detail: detailObject});
                }catch (e) {
                    console.log(e);
                }
            }
        }
    }catch (e) {
        console.log(e);
    }
});


app.post('/validateSchemaS3S',async (req,res)=>{
    try {
        var code = validateToken(req);
        if(code.code == 401){
            res.status(401).json({code: '401', message: code.message});
        }else if (code.code == 200){
            let fileContents = fs.readFileSync(path.resolve(__dirname, '../src/resource/openapis3s.yaml'), 'utf8');
            let data = yaml.safeLoad(fileContents);
            let schemaResults = data.components.schemas.ssancionados.properties.results;
            schemaResults.items.properties.tipoFalta =  data.components.schemas.tipoFalta;
            schemaResults.items.properties.tipoSancion = data.components.schemas.tipoSancion;

            let schemaS3S = schemaResults;

            let validacion = new swaggerValidator.Handler();
            let newdocument = req.body;
            let respuesta=[];
            let arrayDocuments=[];
            let ids= [];
            let c1=1;
            if(Array.isArray(newdocument)){
                for (let doc of newdocument){
                    doc["id"]= c1.toString();
                    c1++;
                    respuesta.push(await validateSchema([doc],schemaS3S,validacion));
                    ids.push(doc.id);
                    arrayDocuments.push(doc);
                }
            }else{
                newdocument["id"]= c1.toString();
                c1++;
                respuesta.push(await validateSchema([newdocument],schemaS3S,validacion));
                arrayDocuments.push(newdocument);
            }

            let wasInvalid;

            for(let val of respuesta){
                if(!val.valid){
                    wasInvalid= true;
                }
            }

            if(wasInvalid){
                res.status(200).json({message : "Error : La validación no fue exitosa" , Status : 500, response : respuesta});
            }else{
                //se insertan
                try {
                    let sancionados = S3S.model('Ssancionados', ssancionadosSchema, 'ssancionados');
                    let response;
                    response = await sancionados.insertMany(arrayDocuments);
                    let detailObject= {};
                    detailObject["numeroRegistros"]= arrayDocuments.length;
                    res.status(200).json({message : "Se realizarón las inserciones correctamente", Status : 200 , response: response, detail: detailObject});
                }catch (e) {
                    console.log(e);
                }
            }
        }
    }catch (e) {
        console.log(e);
    }
});

app.post('/validateSchemaS3P',async (req,res)=>{
    try {
        var code = validateToken(req);
        if(code.code == 401){
            res.status(401).json({code: '401', message: code.message});
        }else if (code.code == 200){
            let fileContents = fs.readFileSync(path.resolve(__dirname, '../src/resource/openapis3p.yaml'), 'utf8');
            let data = yaml.safeLoad(fileContents);
            let schemaResults = data.components.schemas.resParticularesSancionados.properties.results;
            schemaResults.items.properties.particularSancionado.properties.domicilioExtranjero.properties.pais =  data.components.schemas.pais;
            schemaResults.items.properties.tipoSancion = data.components.schemas.tipoSancion;

            let schemaS3P = schemaResults;

            let validacion = new swaggerValidator.Handler();
            let newdocument = req.body;
            let respuesta=[];
            let arrayDocuments=[];
            let ids= [];
            let c1=1;
            if(Array.isArray(newdocument)){
                for (let doc of newdocument){
                    doc["id"]= c1.toString();
                    doc["fechaCaptura"]= moment().format();
                    c1++;
                    respuesta.push(await validateSchema([doc],schemaS3P,validacion));
                    ids.push(doc.id);
                    arrayDocuments.push(doc);
                }
            }else{
                newdocument["id"]= c1.toString();
                newdocument["fechaCaptura"]= moment().format();
                c1++;
                respuesta.push(await validateSchema([newdocument],schemaS3P,validacion));
                arrayDocuments.push(newdocument);
            }

            let wasInvalid;

            for(let val of respuesta){
                if(!val.valid){
                    wasInvalid= true;
                }
            }

            if(wasInvalid){
                res.status(200).json({message : "Error : La validación no fue exitosa" , Status : 500, response : respuesta});
            }else{
                //se insertan
                console.log("paso la validacion");
                try {
                    let psancionados = S3P.model('Psancionados', psancionadosSchema, 'psancionados');
                    let response;
                    response = await psancionados.insertMany(arrayDocuments);
                    let detailObject= {};
                    detailObject["numeroRegistros"]= arrayDocuments.length;
                    res.status(200).json({message : "Se realizarón las inserciones correctamente", Status : 200 , response: response, detail: detailObject});
                }catch (e) {
                    console.log(e);
                }
            }
        }
    }catch (e) {
        console.log(e);
    }
});

app.delete('/deleteUser',async (req,res)=>{
    try {
        var code = validateToken(req);
        if(code.code == 401){
            res.status(401).json({code: '401', message: code.message});
        }else if (code.code == 200 ){
            if(req.body.request._id){
                var data=[];

                let fechabaja = moment().format();
                let response = await User.findByIdAndUpdate( req.body.request._id , {$set: {fechaBaja : fechabaja}} ).exec();
                res.status(200).json({message : "OK" , Status : 200, response : response} );
            }else{
                res.status(500).json([{"Error":"Datos incompletos"}]);
            }
        }
    }catch (e) {
        console.log(e);
    }

});

app.delete('/deleteProvider',async (req,res)=>{
    try {
        var code = validateToken(req);
        if(code.code == 401){
            res.status(401).json({code: '401', message: code.message});
        }else if (code.code == 200 ){

            if(req.body.request._id){
                let fechabaja = moment().format();
                let response = await Provider.findByIdAndUpdate( req.body.request._id , {$set: {fechaBaja : fechabaja}} ).exec();
                res.status(200).json({message : "OK" , Status : 200, response : response});
            }else{
                res.status(500).json({message : "Error : Datos incompletos" , Status : 500});
            }
        }
    }catch (e) {
        console.log(e);
    }

});

app.post('/create/provider',async(req, res)=>{
    try {
        var code = validateToken(req);

        if(code.code == 401){
            res.status(401).json({code: '401', message: code.message});
        }else if (code.code == 200 ) {

            try {
                await schemaProvider.validate({
                    dependencia: req.body.dependencia,
                    sistemas : req.body.sistemas,
                    estatus : true,
                    fechaAlta: req.body.fechaAlta
                });
                req.body["estatus"]=true;

                const nuevoProovedor = new Provider(req.body);
                let responce;
                responce = await nuevoProovedor.save();

                res.status(200).json(responce);
            }catch (e) {
                let errorMessage = {};
                errorMessage["errores"] = e.errors;
                errorMessage["campo"]= e.path;
                errorMessage["tipoError"] = e.type;
                errorMessage["mensaje"] = e.message;
                res.status(400).json(errorMessage);
            }
        }
    }catch (e){
        console.log(e);
    }
});


app.put('/edit/provider',async(req, res)=>{
    try {
        var code = validateToken(req);

        if(code.code == 401){
            res.status(401).json({code: '401', message: code.message});
        }else if (code.code == 200 ) {
            try {
                await Yup.object().shape({ fechaActualizacion: Yup.string().required(),}).concat(schemaProvider).validate({
                    dependencia: req.body.dependencia,
                    sistemas: req.body.sistemas,
                    estatus: req.body.estatus,
                    fechaAlta: req.body.fechaAlta,
                    fechaActualizacion: req.body.fechaActualizacion
                });

                const nuevoProovedor = new Provider(req.body);
                let responce;

                if (req.body._id ) {
                    responce = await Provider.findByIdAndUpdate(req.body._id, nuevoProovedor).exec();
                    res.status(200).json(responce);
                }else {
                    res.status(500).json({message : "Error : Datos incompletos" , Status : 500});
                }
            }catch (e) {
                let errorMessage = {};
                errorMessage["errores"] = e.errors;
                errorMessage["campo"]= e.path;
                errorMessage["tipoError"] = e.type;
                errorMessage["mensaje"] = e.message;
                res.status(400).json(errorMessage);
            }
        }
    }catch (e){
        console.log(e);
    }
});


app.post('/create/user',async (req,res)=>{
    try {

        var code = validateToken(req);
        if(code.code == 401){
            res.status(401).json({code: '401', message: code.message});
        }else if (code.code == 200 ){

            try {
                let fechaActual = moment();
                let newBody = {...req.body ,fechaAlta:  fechaActual.format(), vigenciaContrasena : fechaActual.add(3 , 'months').format().toString(), estatus :true };
                var generator = require('generate-password');

                var password = generator.generate({
                    length: 8,
                    numbers: true,
                    symbols:true,
                    lowercase:true,
                    uppercase:true,
                    strict:true
                });

              await schemaUserCreate.concat(schemaUser).validate({ nombre : newBody.nombre,
                    apellidoUno : newBody.apellidoUno,
                    apellidoDos : newBody.apellidoDos,
                    cargo : newBody.cargo,
                  correoElectronico : newBody.correoElectronico,
                  telefono : newBody.telefono,
                  extension : newBody.extension,
                  usuario : newBody.usuario,
                  constrasena : password,
                  sistemas : newBody.sistemas,
                  proveedorDatos : newBody.proveedorDatos,
                  estatus : newBody.estatus,
                  fechaAlta:newBody.fechaAlta,
                  vigenciaContrasena: newBody.vigenciaContrasena,
                  rol: "2"
              });
                 if(newBody.passwordConfirmation){
                     delete newBody.passwordConfirmation;
                 }

                 delete newBody.constrasena;
                 newBody["constrasena"]=password;
                 newBody["contrasenaNueva"]=true;
                 newBody["rol"]=2;

                const client = new SMTPClient({
                    user: 'soporteportalpdn@gmail.com',
                    password: 'pdndigital-2021',
                    host: 'smtp.gmail.com',
                    ssl: true,
                });

                const message = {
                    text: 'Enviamos tu nueva contraseña del portal PDN',
                    from: 'soporteportalpdn@gmail.com',
                    to: newBody.correoElectronico,
                    subject: 'Enviamos tu nueva contraseña del portal PDN',
                    attachment: [
                        { data: '<html>Buen día anexamos tu contraseña nueva para acceder al portal de la PDN. Contraseña:  <br><i><b><h3>'+password+'</h3></b></i></html>', alternative: true }
                    ],
                };

                client.send(message, function (err, message) {
                    if(err!=null){
                        res.status(200).json({message : "Hay errores al enviar tu nueva contraseña.Ponte en contacto con el administrador." , Status : 500});
                    }
                });

                  const nuevoUsuario = new User(newBody);
                  let response;
                  response = await nuevoUsuario.save();
                  res.status(200).json(response);

            }catch (e) {
                let errorMessage = {};
                errorMessage["errores"] = e.errors;
                errorMessage["campo"]= e.path;
                errorMessage["tipoError"] = e.type;
                errorMessage["mensaje"] = e.message;
                res.status(400).json(errorMessage);
            }
        }
    }catch (e) {
        console.log(e);
    }
});

app.put('/edit/user',async (req,res)=>{
    try {

        var code = validateToken(req);
        if(code.code == 401){
            res.status(401).json({code: '401', message: code.message});
        }else if (code.code == 200 ){
            try{
                await schemaUser.validate({ nombre : req.body.nombre,
                    apellidoUno : req.body.apellidoUno,
                    apellidoDos : req.body.apellidoDos,
                    cargo : req.body.cargo,
                    correoElectronico : req.body.correoElectronico,
                    telefono : req.body.telefono,
                    extension : req.body.extension,
                    usuario : req.body.usuario,
                    constrasena : req.body.constrasena,
                    sistemas : req.body.sistemas,
                    proveedorDatos : req.body.proveedorDatos,
                    estatus : req.body.estatus });

                const nuevoUsuario = new User(req.body);
                let response;
                if(req.body._id ){
                    response = await User.findByIdAndUpdate( req.body._id ,nuevoUsuario).exec();
                    res.status(200).json(response);
                }else{
                    res.status(500).json({message : "Error : Datos incompletos" , Status : 500});
                }
            }catch (e) {
                let errorMessage = {};
                errorMessage["errores"] = e.errors;
                errorMessage["campo"]= e.path;
                errorMessage["tipoError"] = e.type;
                errorMessage["mensaje"] = e.message;
                res.status(400).json(errorMessage);
            }
        }
    }catch (e) {
        console.log(e);
    }
});


app.post('/getUsers',async (req,res)=>{
    try {

        var code = validateToken(req);
        if(code.code == 401){
            res.status(401).json({code: '401', message: code.message});
        }else if (code.code == 200 ){
            let sortObj = req.body.sort  === undefined ? {} : req.body.sort;
            let page = req.body.page === undefined ? 1 : req.body.page ;  //numero de pagina a mostrar
            let pageSize = req.body.pageSize === undefined ? 10 : req.body.pageSize;
            let query = req.body.query === undefined ? {} : req.body.query;

            const paginationResult = await User.paginate(query, {page :page , limit: pageSize, sort: sortObj, rol:"2"}).then();
            let objpagination ={hasNextPage : paginationResult.hasNextPage, page:paginationResult.page, pageSize : paginationResult.limit, totalRows: paginationResult.totalDocs }
            let objresults = paginationResult.docs;

            let objResponse= {};
            objResponse["pagination"] = objpagination;
            objResponse["results"]= objresults;

            res.status(200).json(objResponse);
        }
    }catch (e) {
        console.log(e);
    }

});


app.post('/getUsersFull',async (req,res)=>{
    try {
        var code = validateToken(req);
        if(code.code == 401){
            res.status(401).json({code: '401', message: code.message});
        }else if (code.code == 200 ){
            const result = await User.find({fechaBaja: null, rol:"2"}).then();
            let objResponse= {};
            objResponse["results"]= result;
            res.status(200).json(objResponse);
        }
    }catch (e) {
        console.log(e);
    }
});

/////////////////////////////////////////////////////////SHEMA S2///////////////////////////////////////////

app.post('/insertS2Schema',async (req,res)=>{
    try {
        var code = validateToken(req);
        var usuario=req.body.usuario;
        delete req.body.usuario;
        if(code.code == 401){
            res.status(401).json({code: '401', message: code.message});
        }else if (code.code == 200 ){
            let fileContents = fs.readFileSync( path.resolve(__dirname, '../src/resource/openapis2.yaml'), 'utf8');
            let data = yaml.safeLoad(fileContents);
            let schemaS2 =  data.components.schemas.respSpic;
            let validacion = new swaggerValidator.Handler();
            let newdocument = req.body;
            newdocument["id"]= "FAKEID";
            newdocument["fechaCaptura"]= moment().format();
            let respuesta = await validateSchema([newdocument],schemaS2,validacion);
            if(respuesta.valid){
                try {
                    let Spic = S2.model('Spic',spicSchema, 'spic');
                    delete req.body.id;
                    let esquema= new Spic(req.body);
                    const result = await esquema.save();
                    let objResponse= {};

                    objResponse["results"]= result;
                    var bitacora=[];
                    bitacora["tipoOperacion"]="CREATE";
                    bitacora["fechaOperacion"]= moment().format();
                    bitacora["usuario"]=usuario;
                    bitacora["numeroRegistros"]=1;
                    bitacora["sistema"]="S2";
                    registroBitacora(bitacora);
                    res.status(200).json(objResponse);
                }catch (e) {
                    console.log(e);
                }
            }else{
                res.status(400).json({message : "Error in validation" , Status : 400, response : respuesta});
            }
        }
    }catch (e) {
        console.log(e);
    }
});


app.post('/insertS3SSchema',async (req,res)=>{
    try {
        var code = validateToken(req);
        var usuario=req.body.usuario;
        delete req.body.usuario;
        if(code.code == 401){
            res.status(401).json({code: '401', message: code.message});
        }else if (code.code == 200 ) {

            let values = req.body;

            values['fechaCaptura'] = moment().format();
            values["id"] = "FAKEID";

            let fileContents = fs.readFileSync(path.resolve(__dirname, '../src/resource/openapis3s.yaml'), 'utf8');
            let data = yaml.safeLoad(fileContents);
            let schemaResults = data.components.schemas.ssancionados.properties.results;
            schemaResults.items.properties.tipoFalta = data.components.schemas.tipoFalta;
            schemaResults.items.properties.tipoSancion = data.components.schemas.tipoSancion;

            let schemaS3S = schemaResults;
            let validacion = new swaggerValidator.Handler();
            let respuesta = await validateSchema([values], schemaS3S, validacion);
                //se insertan

            if (respuesta.valid) {
                try {
                    let sancionados = S3S.model('Ssancionados', ssancionadosSchema, 'ssancionados');
                    let response;
                    delete values.id;
                    let esquema= new sancionados(values);
                    const result = await esquema.save();
                    let objResponse= {};
                    objResponse["results"]= result;
                    var bitacora=[];
                    bitacora["tipoOperacion"]="CREATE";
                    bitacora["fechaOperacion"]= moment().format();
                    bitacora["usuario"]=usuario;
                    bitacora["numeroRegistros"]=1;
                    bitacora["sistema"]="S3S";
                    registroBitacora(bitacora);
                    res.status(200).json({message : "Se realizarón las inserciones correctamente", Status : 200 , response: response, detail: objResponse});
                }catch (e) {
                    console.log(e);
                }

            }else{
                console.log(respuesta);
                res.status(400).json({message : "Error in validation openApi" , Status : 400, response : respuesta});
            }
        }
    }catch (e) {
        console.log(e);
    }
});

/////////////////////////////////////////////////////////SHEMA S2///////////////////////////////////////////

app.post('/insertS3PSchema',async (req,res)=>{
    try {
        var code = validateToken(req);
        var usuario=req.body.usuario;
        delete req.body.usuario;
        if(code.code == 401){
            res.status(401).json({code: '401', message: code.message});
        }else if (code.code == 200 ){
            let values = req.body;

            values['fechaCaptura'] = moment().format();
            values["id"] = "FAKEID";

            let fileContents = fs.readFileSync(path.resolve(__dirname, '../src/resource/openapis3p.yaml'), 'utf8');
            let data = yaml.safeLoad(fileContents);
            let schemaResults = data.components.schemas.resParticularesSancionados.properties.results;
            schemaResults.items.properties.particularSancionado.properties.domicilioExtranjero.properties.pais =  data.components.schemas.pais;
            schemaResults.items.properties.tipoSancion = data.components.schemas.tipoSancion;
            let schemaS3P = schemaResults;

            let validacion = new swaggerValidator.Handler();
            let respuesta = await validateSchema([values], schemaS3P, validacion);
            //se insertan

            if (respuesta.valid) {
                try {
                    let psancionados = S3P.model('Psancionados', psancionadosSchema, 'psancionados');
                    let response;
                    delete values.id;
                    console.log(values);
                    let esquema= new psancionados(values);
                    const result = await esquema.save();
                    let objResponse= {};
                    objResponse["results"]= result;
                    var bitacora=[];
                    bitacora["tipoOperacion"]="CREATE";
                    bitacora["fechaOperacion"]= moment().format();
                    bitacora["usuario"]=usuario;
                    bitacora["numeroRegistros"]=1;
                    bitacora["sistema"]="S3P";
                    registroBitacora(bitacora);
                    res.status(200).json({message : "Se realizarón las inserciones correctamente", Status : 200 , response: response, detail: objResponse});
                }catch (e) {
                    console.log(e);
                }

            }else{
                console.log(respuesta);
                res.status(400).json({message : "Error in validation openApi" , Status : 400, response : respuesta});
            }
        }
    }catch (e) {
        console.log(e);
    }
});

app.post('/listSchemaS3S',async (req,res)=> {
    try {
        var code = validateToken(req);
        if(code.code == 401){
            res.status(401).json({code: '401', message: code.message});
        }else if (code.code == 200 ){
            let sancionados =  S3S.model('Ssancionados', ssancionadosSchema, 'ssancionados');
            let sortObj = req.body.sort  === undefined ? {} : req.body.sort;
            let page = req.body.page === undefined ? 1 : req.body.page ;  //numero de pagina a mostrar
            let pageSize = req.body.pageSize === undefined ? 10 : req.body.pageSize;
            let query = req.body.query === undefined ? {} : req.body.query;

            //console.log({page :page , limit: pageSize, sort: sortObj, query: query});
            const paginationResult = await sancionados.paginate(query, {page :page , limit: pageSize, sort: sortObj}).then();
            let objpagination ={hasNextPage : paginationResult.hasNextPage, page:paginationResult.page, pageSize : paginationResult.limit, totalRows: paginationResult.totalDocs }
            let objresults = paginationResult.docs;

            let objResponse= {};
            objResponse["pagination"] = objpagination;
            objResponse["results"]= objresults;

            res.status(200).json(objResponse);
        }
    }catch (e) {
        console.log(e);
    }
});


app.post('/listSchemaS2',async (req,res)=> {
    try {
        var code = validateToken(req);
        if(code.code == 401){
            res.status(401).json({code: '401', message: code.message});
        }else if (code.code == 200 ){
            let Spic = S2.model('Spic',spicSchema, 'spic');
            let sortObj = req.body.sort  === undefined ? {} : req.body.sort;
            let page = req.body.page === undefined ? 1 : req.body.page ;  //numero de pagina a mostrar
            let pageSize = req.body.pageSize === undefined ? 10 : req.body.pageSize;
            let query = req.body.query === undefined ? {} : req.body.query;

            const paginationResult = await Spic.paginate(query, {page :page , limit: pageSize, sort: sortObj}).then();
            let objpagination ={hasNextPage : paginationResult.hasNextPage, page:paginationResult.page, pageSize : paginationResult.limit, totalRows: paginationResult.totalDocs }
            let objresults = paginationResult.docs;

            let objResponse= {};
            objResponse["pagination"] = objpagination;
            objResponse["results"]= objresults;

            res.status(200).json(objResponse);
        }
    }catch (e) {

    }
});

app.post('/listSchemaS3P',async (req,res)=> {
    try {
        var code = validateToken(req);
        if(code.code == 401){
            res.status(401).json({code: '401', message: code.message});
        }else if (code.code == 200 ){
            let sancionados =  S3P.model('Psancionados', psancionadosSchema, 'psancionados');
            let sortObj = req.body.sort  === undefined ? {} : req.body.sort;
            let page = req.body.page === undefined ? 1 : req.body.page ;  //numero de pagina a mostrar
            let pageSize = req.body.pageSize === undefined ? 10 : req.body.pageSize;
            let query = req.body.query === undefined ? {} : req.body.query;

            const paginationResult = await sancionados.paginate(query, {page :page , limit: pageSize, sort: sortObj}).then();
            let objpagination ={hasNextPage : paginationResult.hasNextPage, page:paginationResult.page, pageSize : paginationResult.limit, totalRows: paginationResult.totalDocs }
            let objresults = paginationResult.docs;

            let objResponse= {};
            objResponse["pagination"] = objpagination;
            objResponse["results"]= objresults;

            res.status(200).json(objResponse);
        }
    }catch (e) {
        console.log(e);
    }
});


app.delete('/deleteRecordS2',async (req,res)=>{
    try {
        var code = validateToken(req);
        var bitacora=[];
        if(code.code == 401){
            res.status(401).json({code: '401', message: code.message});
        }else if (code.code == 200 ){
            if(req.body.request._id){
                let Spic = S2.model('Spic',spicSchema, 'spic');
                let deletedRecord;
                let numRecords=0;
                if(Array.isArray(req.body.request._id)){
                    numRecords= req.body.request._id.length;
                    deletedRecord =  await Spic
                        .deleteMany({_id: {
                        $in:req.body.request._id
                    }})
                        .catch(err => res.status(400).json({message : err.message , code: '400'})).then();
                }else{
                    numRecords=1;
                    deletedRecord =  await Spic
                        .findByIdAndDelete( req.body.request._id)
                        .catch(err => res.status(400).json({message : err.message , code: '400'})).then();
                }

                bitacora["tipoOperacion"]="DELETE";
                bitacora["fechaOperacion"]= moment().format();
                bitacora["usuario"]=req.body.request.usuario;
                bitacora["numeroRegistros"]=numRecords;
                bitacora["sistema"]="S2";
                registroBitacora(bitacora);
                res.status(200).json({message : "OK" , Status : 200, response : deletedRecord , messageFront: "Se eliminaron "+ numRecords+ " registros correctamente " });
            }else{
                res.status(500).json({message:"Datos incompletos", code:'500'});
            }
        }
    }catch (e) {
        console.log(e);
    }

});


app.delete('/deleteRecordS3S',async (req,res)=>{
    try {
        var code = validateToken(req);
        var bitacora=[];
        if(code.code == 401){
            res.status(401).json({code: '401', message: code.message});
        }else if (code.code == 200 ){
            if(req.body.request._id){
                let sancionados =  S3S.model('Ssancionados', ssancionadosSchema, 'ssancionados');
                let deletedRecord;
                let numRecords=0;
                if(Array.isArray(req.body.request._id)){
                    numRecords= req.body.request._id.length;
                    deletedRecord =  await sancionados
                        .deleteMany({_id: {
                                $in:req.body.request._id
                            }})
                        .catch(err => res.status(400).json({message : err.message , code: '400'})).then();
                }else{
                    numRecords=1;
                    deletedRecord =  await sancionados
                        .findByIdAndDelete( req.body.request._id)
                        .catch(err => res.status(400).json({message : err.message , code: '400'})).then();
                }


                bitacora["tipoOperacion"]="DELETE";
                bitacora["fechaOperacion"]= moment().format();
                bitacora["usuario"]=req.body.request.usuario;
                bitacora["numeroRegistros"]=numRecords;
                bitacora["sistema"]="S3S";
                registroBitacora(bitacora);
                res.status(200).json({message : "OK" , Status : 200, response : deletedRecord , messageFront: "Se eliminaron "+ numRecords+ " registros correctamente " });
            }else{
                res.status(500).json({message:"Datos incompletos", code:'500'});
            }
        }
    }catch (e) {
        console.log(e);
    }

});

app.delete('/deleteRecordS3P',async (req,res)=>{
    try {
        var code = validateToken(req);
        var bitacora=[];
        if(code.code == 401){
            res.status(401).json({code: '401', message: code.message});
        }else if (code.code == 200 ){
            if(req.body.request._id){
                let sancionados =  S3P.model('Psancionados', psancionadosSchema, 'psancionados');
                let deletedRecord;
                let numRecords=0;
                if(Array.isArray(req.body.request._id)){
                    numRecords= req.body.request._id.length;
                    deletedRecord =  await sancionados
                        .deleteMany({_id: {
                                $in:req.body.request._id
                            }})
                        .catch(err => res.status(400).json({message : err.message , code: '400'})).then();
                }else{
                    numRecords=1;
                    deletedRecord =  await sancionados
                        .findByIdAndDelete( req.body.request._id)
                        .catch(err => res.status(400).json({message : err.message , code: '400'})).then();
                }


                bitacora["tipoOperacion"]="DELETE";
                bitacora["fechaOperacion"]= moment().format();
                bitacora["usuario"]=req.body.request.usuario;
                bitacora["numeroRegistros"]=numRecords;
                bitacora["sistema"]="S3P";
                registroBitacora(bitacora);
                res.status(200).json({message : "OK" , Status : 200, response : deletedRecord , messageFront: "Se eliminaron "+ numRecords+ " registros correctamente " });
            }else{
                res.status(500).json({message:"Datos incompletos", code:'500'});
            }
        }
    }catch (e) {
        console.log(e);
    }

});

app.post('/updateS3SSchema',async (req,res)=>{
    try {
        var code = validateToken(req);
        var usuario = req.body.usuario;
        delete req.body.usuario;
        if (code.code == 401) {
            res.status(401).json({code: '401', message: code.message});
        } else if (code.code == 200) {
            let id = req.body._id;
            delete req.body._id;
            let values = req.body;
            values['fechaCaptura'] = moment().format();
            values["id"] = "FAKEID";

            let fileContents = fs.readFileSync(path.resolve(__dirname, '../src/resource/openapis3s.yaml'), 'utf8');
            let data = yaml.safeLoad(fileContents);
            let schemaResults = data.components.schemas.ssancionados.properties.results;
            schemaResults.items.properties.tipoFalta = data.components.schemas.tipoFalta;
            schemaResults.items.properties.tipoSancion = data.components.schemas.tipoSancion;

            let schemaS3S = schemaResults;
            let validacion = new swaggerValidator.Handler();
            let respuesta = await validateSchema([values], schemaS3S, validacion);
            //se insertan

            if (respuesta.valid) {
                try {
                    values["_id"] = id;
                    let sancionados = S3S.model('Ssancionados', ssancionadosSchema, 'ssancionados');
                    let esquema = new sancionados(values);
                    console.log("IDDD" + esquema);
                    let response;
                    if (values._id) {
                        await sancionados.findByIdAndDelete(values._id);
                        response = await sancionados.findByIdAndUpdate(values._id, esquema, {
                            upsert: true,
                            new: true
                        }).exec();
                        let objResponse = {};
                        objResponse["results"] = response;
                        var bitacora = [];
                        bitacora["tipoOperacion"] = "UPDATE";
                        bitacora["fechaOperacion"] = moment().format();
                        bitacora["usuario"] = usuario;
                        bitacora["numeroRegistros"] = 1;
                        bitacora["sistema"] = "S3S";
                        registroBitacora(bitacora);
                        res.status(200).json(response);
                    } else {
                        res.status(500).json({message: "Error : Datos incompletos", Status: 500});
                    }
                } catch (e) {
                    console.log(e);
                }

            } else {
                console.log(respuesta);
                res.status(400).json({message: "Error in validation openApi", Status: 400, response: respuesta});
            }
            }
        }catch (e) {
            console.log(e);
        }
});


app.post('/updateS2Schema',async (req,res)=>{
    try {
        var code = validateToken(req);
        if(code.code == 401){
            res.status(401).json({code: '401', validateSchmessage: code.message});
        }else if (code.code == 200 ){
            let docSend={};
            let values = req.body;
            //validaciones
            console.log("estamos en las validaciones ");
            try {
                await esquemaS2.validate(values);
            }catch (e) {
                let errorMessage = {};
                errorMessage["errores"] = e.errors;
                errorMessage["campo"]= e.path;
                errorMessage["tipoError"] = e.type;
                errorMessage["mensaje"] = e.message;
                res.status(400).json(errorMessage);
            }

            docSend["id"]= values._id;
            docSend['fechaCaptura'] = moment().format();

            if(values.ejercicioFiscal){docSend["ejercicioFiscal"]= values.ejercicioFiscal;}
            if(values.ramo){
                let ramoObj = JSON.parse(values.ramo);
                docSend["ramo"]= {clave:  parseInt(ramoObj.clave) , valor: ramoObj.valor };
            }
            if(values.nombres){docSend["nombres"]=values.nombres}
            if(values.primerApellido){docSend["primerApellido"]=values.primerApellido}
            if(values.segundoApellido){docSend["segundoApellido"]= values.segundoApellido}
            if(values.genero){
                docSend["genero"]= JSON.parse(values.genero);
            }

            let ObjInstitucionDepe = {};
            if(values.idnombre){  ObjInstitucionDepe = {...ObjInstitucionDepe,nombre : values.idnombre } }
            if(values.idclave){ObjInstitucionDepe = {...ObjInstitucionDepe,clave: values.idclave } }
            if(values.idsiglas){ObjInstitucionDepe = {...ObjInstitucionDepe,siglas: values.idsiglas } }
            docSend["institucionDependencia"] = ObjInstitucionDepe;


            let objPuesto = {}
            if(values.puestoNombre){objPuesto= {...objPuesto,nombre: values.puestoNombre}}
            if(values.puestoNivel){objPuesto= {...objPuesto, nivel: values.puestoNivel}}
            docSend["puesto"]= objPuesto;


            if(values.tipoArea && values.tipoArea.length > 0 ){
                docSend["tipoArea"]=JSON.parse("["+values.tipoArea+"]");
            }
            if(values.tipoProcedimiento && values.tipoProcedimiento.length > 0){
                let ObjTipoProcedimiento= JSON.parse("["+values.tipoProcedimiento+"]");
                docSend["tipoProcedimiento"]= getArrayFormatTipoProcedimiento(ObjTipoProcedimiento);
            }
            if(values.nivelResponsabilidad && values.nivelResponsabilidad.length > 0 ){
                docSend["nivelResponsabilidad"] = JSON.parse("[" + values.nivelResponsabilidad + "]");
            }

            let objSuperiorInmediato = {};
            if(values.sinombres){
                objSuperiorInmediato = {...objSuperiorInmediato, nombres: values.sinombres}
            }
            if(values.siPrimerApellido){
                objSuperiorInmediato = {...objSuperiorInmediato, primerApellido: values.siPrimerApellido}
            }
            if(values.siSegundoApellido){
                objSuperiorInmediato = {...objSuperiorInmediato, segundoApellido : values.siSegundoApellido}
            }
            let puestoObj={};
            if(values.siPuestoNombre){
                puestoObj =  {...puestoObj,nombre:values.siPuestoNombre};
            }
            if(values.siPuestoNivel){
                puestoObj =  {...puestoObj,nivel: values.siPuestoNivel};
            }
            if(values.siPuestoNombre || values.siPuestoNivel ){
                objSuperiorInmediato = {...objSuperiorInmediato,puesto: puestoObj}
            }

            docSend["superiorInmediato"] = objSuperiorInmediato;

            console.log("ya paso la validacion  "+ JSON.stringify(docSend));

            let fileContents = fs.readFileSync( path.resolve(__dirname, '../src/resource/openapis2.yaml'), 'utf8');
            let data = yaml.safeLoad(fileContents);
            let schemaS2 =  data.components.schemas.respSpic;
            let validacion = new swaggerValidator.Handler();
            let newdocument = docSend;
            let respuesta = await validateSchema([newdocument],schemaS2,validacion);
            if(respuesta.valid) {
                try {
                    docSend["_id"]= values._id;
                    let Spic = S2.model('Spic',spicSchema, 'spic');
                    let esquema = new Spic(docSend);
                    console.log("IDDD"+ esquema);
                    let response;
                    if(req.body._id ){
                        await Spic.findByIdAndDelete(values._id);
                        response = await Spic.findByIdAndUpdate(values._id ,esquema, {upsert: true, new: true} ).exec();
                        var bitacora=[];
                        bitacora["tipoOperacion"]="UPDATE";
                        bitacora["fechaOperacion"]= moment().format();
                        bitacora["usuario"]=req.body.usuario;
                        bitacora["numeroRegistros"]=1;
                        bitacora["sistema"]="S2";
                        registroBitacora(bitacora);
                        res.status(200).json(response);
                    }else{
                        res.status(500).json({message : "Error : Datos incompletos" , Status : 500});
                    }
                }catch (e) {
                    console.log(e);
                }
            }else{
                console.log(respuesta);
                res.status(400).json({message : "Error in validation openApi" , Status : 400, response : respuesta});
            }
        }
    }catch (e) {
        console.log(e);
    }
});


app.post('/getProviders',async (req,res)=>{
    try {

        var code = validateToken(req);
        if(code.code == 401){
            res.status(401).json({code: '401', message: code.message});
        }else if (code.code == 200 ){
            let sortObj = req.body.sort  === undefined ? {} : req.body.sort;
            let page = req.body.page === undefined ? 1 : req.body.page ;  //numero de pagina a mostrar
            let pageSize = req.body.pageSize === undefined ? 10 : req.body.pageSize;
            let query = req.body.query === undefined ? {} : req.body.query;
            console.log({page :page , limit: pageSize, sort: sortObj});
            const paginationResult = await Provider.paginate(query, {page :page , limit: pageSize, sort: sortObj}).then();
            let objpagination ={hasNextPage : paginationResult.hasNextPage, page:paginationResult.page, pageSize : paginationResult.limit, totalRows: paginationResult.totalDocs }
            let objresults = paginationResult.docs;

            let objResponse= {};
            objResponse["pagination"] = objpagination;
            objResponse["results"]= objresults;

            res.status(200).json(objResponse);
        }
    }catch (e) {
        console.log(e);
    }

});


    app.post('/getProvidersFull',async (req,res)=>{
    try {

        var code = validateToken(req);
        if(code.code == 401){
            res.status(401).json({code: '401', message: code.message});
        }else if (code.code == 200 ) {
            const result = await Provider.find({fechaBaja: null}).then();
            let objResponse = {};

            try {
                var strippedRows = _.map(result, function (row) {
                    let rowExtend = _.extend({label: row.dependencia, value: row._id}, row.toObject());
                    return rowExtend;
                });
            } catch (e) {
                console.log(e);
            }

            console.log({page :"pages" , limit: "pageSize", sort: "sortObj"});
            objResponse["results"] = strippedRows;
            res.status(200).json(objResponse);
        }
    }catch (e) {
        console.log(e);
    }
});

app.post('/getUsersAll',async (req,res)=>{
    try {

        var code = validateToken(req);
        if(code.code == 401){
            res.status(401).json({code: '401', message: code.message});
        }else if (code.code == 200 ) {
            const result = await User.find({rol:"2"});
            let objResponse = {};

            try {
                var strippedRows = _.map(result, function (row) {
                    let rowExtend = _.extend({label: (row.nombre+" "+row.apellidoUno+" "+row.apellidoDos), value: row._id}, row.toObject());
                    return rowExtend;
                });
            } catch (e) {
                console.log(e);
            }
            objResponse["results"] = strippedRows;
            res.status(200).json(objResponse);
        }
    }catch (e) {
        console.log(e);
    }
});

app.post('/getCatalogs',async (req,res)=>{
    try {
        var code = validateToken(req);
        let docType= req.body.docType;
        if(code.code == 401){
            res.status(401).json({code: '401', message: code.message});
        }else if (code.code == 200 ){
            const result = await Catalog.find({docType: docType}).then();
            let objResponse= {};
            let strippedRows;
            if(docType === "genero" || docType === "ramo"|| docType === "tipoArea" || docType=== "nivelResponsabilidad" || docType === "tipoProcedimiento"
            ||docType === "tipoFalta" || docType === "tipoSancion" || docType === "moneda" || docType === "tipoDocumento" || docType === "tipoPersona"
            ||docType === "pais" ||docType === "estado" ||docType === "municipio" ||docType === "vialidad" ){
                try {
                     strippedRows = _.map(result, function (row) {
                        let rowExtend = _.extend({label: row.valor, value: JSON.stringify({clave:row.clave ,valor : row.valor})}, row.toObject());
                        return rowExtend;
                    });
                } catch (e) {
                    console.log(e);
                }
            }else if(docType === "puesto"){
                try {
                     strippedRows = _.map(result, function (row) {
                        let rowExtend = _.extend({label: row.nombre, value: row.nivel}, row.toObject());
                        return rowExtend;
                    });
                } catch (e) {
                    console.log(e);
                }
            }

            objResponse["results"]= strippedRows;
            res.status(200).json(objResponse);
        }
    }catch (e) {
        console.log(e);
    }
});

app.post('/getBitacora',async (req,res)=>{
    try {
        function horaActual(horaAct){
            var zona = (new Date()).getTimezoneOffset()*60000 ; //offset in milliseconds
            var hora = (new Date(horaAct-zona)).toISOString().slice(0, -5);
            return hora;
        }
        var fechaInicial=horaActual(new Date(req.body.fechaInicial));
        var fechaFinal=horaActual(new Date(req.body.fechaFinal));
        let objResponse= {};
        let strippedRows;

        if(fechaInicial=="" || fechaFinal==""){
            res.status(500).json({message : "Error : Datos incompletos" , Status : 500});
        }

        var code = validateToken(req);
        if(code.code == 401){
            res.status(401).json({code: '401', message: code.message});
        }else if (code.code == 200 ){
            let sortObj = req.body.sort  === undefined ? {} : req.body.sort;
            let page = req.body.page === undefined ? 1 : req.body.page ;  //numero de pagina a mostrar
            let pageSize = req.body.pageSize === undefined ? 10 : req.body.pageSize;
            let query = req.body.query === undefined ? {} : req.body.query;
            console.log({page :page , limit: pageSize, sort: sortObj});
            if(((typeof req.body.sistema!="undefined")) && ((typeof req.body.usuarioBitacora !="undefined"))){
                var paginationResult = await Bitacora.find({fechaOperacion: { $gte: fechaInicial, $lte : fechaFinal }, usuario: { $eq : req.body.usuarioBitacora }, sistema: { $in : req.body.sistema }});
                formato(paginationResult);
            }else if((typeof req.body.sistema!="undefined")){
                var paginationResult = await Bitacora.find({fechaOperacion: { $gte: fechaInicial, $lte : fechaFinal },sistema: {$in : req.body.sistema }});
                formato(paginationResult);
            }else if((typeof req.body.usuarioBitacora!="undefined")){
                var paginationResult = await Bitacora.find({fechaOperacion: { $gte: fechaInicial, $lte :fechaFinal }, usuario: { $eq : req.body.usuarioBitacora}});
                formato(paginationResult);
            }else{
                var paginationResult = await Bitacora.find({fechaOperacion: { $gte: fechaInicial, $lte : fechaFinal }});
                formato(paginationResult);
            }

            function formato(paginationResult){
                moment.locale('es');
                strippedRows = _.map(paginationResult, function (row) {
                    var fecha=moment(row.fechaOperacion).format('LLLL');
                    var sistema=row.sistema;
                    var sistema_label="";
                    var tipoOperacion=row.tipoOperacion;
                    var tipo="";

                    if(sistema=="S2"){
                        sistema_label="Sistema de Servidores Públicos que Intervienen en Procedimientos de Contratación.";
                    }
                    if(sistema=="S3S"){
                        sistema_label="Sistema de los Servidores Públicos Sancionados.";
                    }
                    if(sistema=="S3P"){
                        sistema_label="Sistema de los Particulares Sancionados.";
                    }
                    if(tipoOperacion=="CREATE"){
                        tipo="Alta";
                    }
                    if(tipoOperacion=="DELETE"){
                        tipo="Eliminación";
                    }
                    if(tipoOperacion=="UPDATE"){
                        tipo="Actualización";
                    }
                    if(tipoOperacion=="READ"){
                        tipo="Consulta";
                    }

                    let rowExtend = _.extend({fecha: fecha,tipo:tipo, sistema_label:sistema_label}, row.toObject());
                    return rowExtend;
                });

                paginationResult["resultado"]=strippedRows;
            }

            let objpagination ={hasNextPage : paginationResult.hasNextPage, page:paginationResult.page, pageSize : paginationResult.limit, totalRows: paginationResult.totalDocs }
            let objresults = paginationResult;
            let objResponse= {};
            //objResponse["pagination"] = objpagination;
            objResponse["results"]= paginationResult["resultado"];

            res.status(200).json(objResponse);
        }
    }catch (e) {
        console.log(e);
    }

});

app.post('/resetpassword',async (req,res)=>{
    try {
        let correo= req.body.correo;
        const correoValidar = Yup.string().email().required();
        const validacion=(await correoValidar.isValid(correo));

        if(validacion==false){
            res.status(200).json({message : "Correo electrónico inválido." , Status : 500});
            return false;
        }

        const estatus = await User.find({correoElectronico: correo, estatus:false}).then();

        if(estatus.length>0){
            res.status(200).json({message : "El usuario está dado de baja en el sistema." , Status : 500});
            return false;
        }

        const result = await User.find({correoElectronico: correo}).then();

        if(result.length==0){
            res.status(200).json({message : "El Correo electrónico que ingresaste no existe." , Status : 500});
            return false;
        }

        var generator = require('generate-password');

        var password = generator.generate({
            length: 8,
            numbers: true,
            symbols:true,
            lowercase:true,
            uppercase:true,
            strict:true
        });

        const client = new SMTPClient({
            user: 'soporteportalpdn@gmail.com',
            password: 'pdndigital-2021',
            host: 'smtp.gmail.com',
            ssl: true,
        });

        const message = {
            text: 'Enviamos tu nueva contraseña del portal PDN',
            from: 'soporteportalpdn@gmail.com',
            to: correo,
            subject: 'Enviamos tu nueva contraseña del portal PDN',
            attachment: [
                { data: '<html>Buen día anexamos tu contraseña nueva para acceder al portal de la PDN. Contraseña:  <br><i><b><h3>'+password+'</h3></b></i></html>', alternative: true }
            ],
        };

// send the message and get a callback with an error or details of the message that was sent
        client.send(message, function (err, message) {
            if(err!=null){
                res.status(200).json({message : "Hay errores al enviar tu nueva contraseña.Ponte en contacto con el administrador." , Status : 500});
            }
        });
        let fechaActual = moment();

        const respuesta= await User.updateOne({correoElectronico: correo },{constrasena: password ,contrasenaNueva:true,vigenciaContrasena : fechaActual.add(3 , 'months').format().toString()});
        res.status(200).json({message : "Se ha enviado tu nueva contraseña al correo electrónico proporcionado." , Status : 200});

        }catch (e) {
        console.log(e);
    }
});

app.post('/changepassword',async (req,res)=>{
    try {
        let constrasena= req.body.constrasena;
        let passwordConfirmation= req.body.passwordConfirmation;
        let id= req.body.user;

        if(constrasena!=passwordConfirmation){
            res.status(200).json({message : "Las contraseñas no coinciden." , Status : 500});
            return false;
        }
        let fechaActual = moment();


        const result = await User.update({_id:id},{constrasena: constrasena,contrasenaNueva:false,  vigenciaContrasena : fechaActual.add(3 , 'months').format().toString()}).then();
        res.status(200).json({message : "¡Se ha actualizado tu contraseña!.Favor de cerrar la sesión e iniciar nuevamente." , Status : 200});

    }catch (e) {
        console.log(e);
    }
});

app.post('/validationpassword',async (req,res)=>{
    var code = validateToken(req);
    if(code.code == 401){
        res.status(401).json({code: '401', message: code.message});
    }else if (code.code == 200 ) {
        try {
            let id_usuario=req.body.id_usuario;

            if(id_usuario==""){
                res.status(200).json({message : "Id Usuario requerido." , Status : 500});
                return false;
            }

            const result=await User.findById(id_usuario).exec();

            if(result.contrasenaNueva===true){
                res.status(200).json({message : "Necesitas cambiar tu contraseña" , Status : 500, contrasenaNueva:true, rol:result.rol, sistemas:result.sistemas});
            }else{
                res.status(200).json({message : "Tu contraseña está al día." , Status : 200, contrasenaNueva:false, rol:result.rol, sistemas:result.sistemas});
            }


        }catch (e) {
            console.log(e);
        }

    }

});
