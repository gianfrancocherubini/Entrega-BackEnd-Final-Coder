

import jwt from "jsonwebtoken";
import bcrypt from 'bcrypt';
import moment from 'moment';
import { enviarWs } from "../config/config.whatsApp.js";
import { UsuariosMongoDao } from '../dao/usuariosDao.js';
import { CarritoService } from "../repository/carrito.service.js";
import { enviarEmail } from "../mails/mails.js";

const carritoDao = new CarritoService();
const usuariosDao =new UsuariosMongoDao();


export class UsuarioController {
    constructor(){}

    static async perfilUsuario(req,res){

        let usuario = req.session.usuario;
        let admin;
        if(usuario.rol === 'administrador'){
             admin = true
        }else{
            admin =false
        }
        res.setHeader('Content-Type', 'text/html');
        res.status(200).render('perfil', { usuario, login: true, admin: admin });
    
    }

    static async obtenerTodosUsuarios(req, res) {
       
        try {
            let usuario = req.session.usuario

            let admin;
            if(usuario && usuario.rol === 'administrador'){
                admin = true;
            } else {
                admin = false;
            }    
            
            const todosUsuarios = await usuariosDao.getTodosUsuarios();
            res.setHeader('Content-Type', 'text/html');
            res.status(200).render('usuariosParaAdmin', {
                usuarios: todosUsuarios,
                usuario,
                login: true,
                admin: admin
            });
        } catch (error) {
            console.log("Error inesperado en el servidor - Intente más tarde, o contacte a su administrador");
            res.setHeader('Content-Type', 'application/json');
            res.status(500).json({ error: "Error inesperado en el servidor - Intente más tarde, o contacte a su administrador" });
        }
    }

    static async cambiarUsuario(req, res) {

        const usuarioId = req.params.cid;
        try {

            let usuario = await usuariosDao.getUsuarioById(usuarioId)
            let nuevoRol;
            if (usuario.rol === 'usuario') {
                nuevoRol = 'premium';
            } else if (usuario.rol === 'premium') {
                nuevoRol = 'usuario';
            } 
    
            await usuariosDao.modificarUsuarioRol(usuarioId, nuevoRol);
    
            console.log("Rol de usuario cambiado exitosamente.");
            res.setHeader('Content-Type', 'application/json');
            res.status(200).json(`Usuario: ${usuarioId} cambiado de rol`);
        } catch (error) {
            console.log(`Error inesperado en el servidor - Intente más tarde, o contacte a su administrador`);
            res.setHeader('Content-Type', 'application/json');
            return res.status(500).json({error:`Error inesperado en el servidor - Intente más tarde, o contacte a su administrador`})
        }
    }

    static async eliminarUsuarioDeBaseDeDatos(req, res) {
        const usuarioId = req.params.cid;
        const usuario = req.session.usuario;
        try {

            if(usuario.rol !== 'administrador'){
                console.log('No tiene permiso para realizar la eliminacion de usuarios');
                res.setHeader('Content-Type', 'application/json');
                return res.status(403).json({ error: 'No tiene permiso para realizar la eliminacion de usuarios' });
            }
            const usuarioEliminar = await usuariosDao.getUsuarioById(usuarioId);
    
            if (!usuarioEliminar) {
                console.log('Usuario no encontrado');
                res.setHeader('Content-Type', 'application/json');
                return res.status(404).json({ error: 'Usuario no encontrado.' });
            }
    
            const emailUsuario = usuarioEliminar.email;
    
            const carrito = usuarioEliminar.carrito;
            const eliminarCarrito = await carritoDao.cartDelete(carrito);
            if (!eliminarCarrito) {
                console.log('Error al eliminar el carrito del usuario');
                res.setHeader('Content-Type', 'application/json');
                return res.status(500).json({ error: 'Error al eliminar el carrito del usuario.' });
            }
    
            const eliminarUsuario = await usuariosDao.eliminarUsuario(usuarioId);
            if (!eliminarUsuario) {
                console.log('Error al eliminar el usuario');
                res.setHeader('Content-Type', 'application/json');
                return res.status(500).json({ error: 'Error al eliminar el usuario.' });
            }
    
            const mensaje = `Estimado/a ${usuarioEliminar.nombre}, tu cuenta ha sido eliminada.`;
            await enviarEmail(emailUsuario, 'Cuenta eliminada', mensaje);
            console.log('Usuario eliminado correctamente y correo electrónico enviado.');
            res.setHeader('Content-Type', 'application/json');
            return res.status(200).json({ message: 'Usuario eliminado correctamente y correo electrónico enviado.' });
    
        } catch (error) {
            console.log('Error inesperado en el servidor - Intente más tarde, o contacte a su administrador');
            res.setHeader('Content-Type', 'application/json');
            return res.status(500).json({ error: 'Error inesperado en el servidor - Intente más tarde, o contacte a su administrador' });
        }
    }


    static async eliminarPorInactividad(req,res){

        try {
            
            const usuarios = await usuariosDao.getTodosUsuarios();
            console.log(usuarios)

            if(!usuarios.length){
                console.log('No existen usuarios en la base de datos')
                res.setHeader('Content-Type', 'application/json');
                return res.status(404).json({ error: 'No existen usuarios en la base de datos' });
            }

            const fechaActual = moment();
            const fechaHace24Horas = moment().subtract(24, 'hours');

            for (const usuario of usuarios){

                const fechaUsuario = moment(usuario.last_connection, 'DD/MM/YYYY, HH:mm:ss');
                console.log('La fecha del usuario:', usuario.nombre, 'es:', fechaUsuario.format());
                 
                const idUsuario = usuario._id;
                const carrito = usuario.carrito;

                if (fechaUsuario.isBefore(fechaHace24Horas)){

                    
                    let eliminarCarrito = await carritoDao.cartDelete(carrito);
                    console.log(carrito)
                    
                    let eliminarUsuario = await usuariosDao.eliminarPorInactividad(idUsuario);
                    console.log(idUsuario)
                    
                    const mensaje = `Estimado/a ${usuario.nombre}, su cuenta en E-commerce Cheru ha sido eliminada debido a inactividad.`;
                    
                    let enviarMensaje = await enviarEmail(usuario.email, 'Cuenta eliminada por inactividad', mensaje);
                    
                    
                }
            }

            console.log(`Usuarios eliminados debido a inactividad`);
            res.setHeader('Content-Type', 'application/json');
            return res.status(200).json({ message: `Usuarios eliminados debido a inactividad` });

        } catch (error) {
            console.log('hola Error inesperado en el servidor - Intente más tarde, o contacte a su administrador', error);
            res.setHeader('Content-Type', 'application/json');
            return res.status(500).json({ error: ' hola Error inesperado en el servidor - Intente más tarde, o contacte a su administrador' });
        }

    }


    static async consultasWs(req,res){
        
        const consulta = req.body.consulta; 
        try {
            let usuario = req.session.usuario;
            
            let admin;
            if(usuario && usuario.rol === 'administrador'){
                admin = true;
            } else {
                admin = false;
            }    

            if (usuario.rol === 'administrador') {
                console.log(`No tiene permiso para realizar consultas por ser administrador`);
                res.setHeader('Content-Type', 'application/json');
                return res.status(403).json({ error: 'No tiene permiso para realizar consultas por ser administrador' });
            } 
            let mensajeEnviado= await enviarWs(consulta);
            console.log(consulta)
            res.setHeader('Content-Type', 'text/html');
            res.status(201).render('perfil',{ mensajeEnviado, usuario, login: true, admin: admin });
        } catch (error) {
            console.log("Error inesperado en el servidor - Intente más tarde, o contacte a su administrador")
            res.setHeader('Content-Type', 'text/html');
            res.status(500).send("Error inesperado en el servidor - Intente más tarde, o contacte a su administrador");
        }
    }


    static async renderRecuperoPassword(req,res){
        let {error, mensaje} =req.query;
        let usuario = req.session.usuario;

        let admin;
            if(usuario && usuario.rol === 'administrador'){
                admin = true;
            } else {
                admin = false;
            } 
        res.setHeader('Content-Type', 'text/html');
        res.status(200).render('recupero', { usuario, login: false, error, mensaje, admin: admin });
    }


    static async recuperoPassword01 (req, res){
        let {email} = req.body
        let usuario = await usuariosDao.getUsuarioByEmailLogin(email);
        if(!usuario){
            return res.redirect('/recuperoPassword?error=No se encontro el usuario con el email proporcionado, verifique si es el correcto!')
        }
        
        let token=jwt.sign({...usuario}, "CoderCoder123", {expiresIn:"1h"})
        let mensaje=`Hola. Ha solicitado recuperar su contraseña!.
            Haga click en el siguiente link: <a href="http://localhost:3012/recuperoPassword02?token=${token}">Recuperar Contraseña</a>
            para reestablecer su contraseña`;

        let respuesta = await enviarEmail(email, "Recupero Password", mensaje)
        if(respuesta.accepted.length>0){
            console.log('Se ha enviado el mail para recuperar la contraseña')
            res.redirect('/recuperoPassword?mensaje=Recibira al instante un mail para recuperar la contraseña! Verifique su casilla de correo.')
        }else{
            console.log('Error al intentar recuperar la contraseña')
            res.redirect('/recuperoPassword?mensaje=Error al intentar recuperar contraseña')

        }
    }

    static async renderRecuperoPassword02(req, res) {

        try {
            let { token, mensaje, error } = req.query;
            // Verifica el token y extrae los datos del usuario si el token es válido
            let datosToken = jwt.verify(token, "CoderCoder123");
            res.setHeader('Content-Type', 'text/html');
            return res.status(200).render("recupero02", { token, mensaje, error });
        } catch (error) {
            // Si hay un error al verificar el token, redirige con un mensaje de error
            return res.redirect(`/recuperoPassword02?token=${token}&error=Error token: `+ error.message);
        }
    }

    static async recuperoPassword03 (req,res){

        let {password, password2, token} = req.body

        if(password !== password2){
           return res.redirect(`/recuperoPassword02?token=${token}&error=Error las claves deben coincidir`);
        }
        if(!req.body.password || !req.body.password2){
            return res.redirect(`/recuperoPassword02?token=${token}&error=Debe completar todos los campos`);
        }

        try {
            let datosToken=jwt.verify(token, "CoderCoder123")
            console.log('los datos del token: ', datosToken)
            let usuario=await usuariosDao.getUsuarioByEmailLogin(datosToken.email);
            
            if(bcrypt.compareSync(password, usuario.password)){
               return res.redirect(`/recuperoPassword02?token=${token}&error=Ha ingresado una contraseña existente. No esta permitido`);
            }
            
            let usuarioActualizado={...usuario, password:bcrypt.hashSync(password, bcrypt.genSaltSync(10))}
            
    
            console.log('El usuario actualizado es:',usuarioActualizado)
            await usuariosDao.modificarUsuarioPorMail(datosToken.email,usuarioActualizado);

            return res.redirect("/recuperoPassword?mensaje=Constraseña restablecida")
        } catch (error) {
            console.log('Error inesperado en el servidor - Intente más tarde, o contacte a su administrador')
            res.setHeader('Content-Type','application/json');
            return res.status(500).json({error:`Error inesperado en el servidor - Intente más tarde, o contacte a su administrador`})
        }
    }

}


