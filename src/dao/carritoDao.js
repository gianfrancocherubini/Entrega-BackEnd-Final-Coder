

import { Cart } from './models/carrito.model.js';
import { ProductEsquema } from './models/products.model.js';

export class CarritoMongoDao {
    
    async createEmptyCart() {
        try {
            const newCart = new Cart({});
            await newCart.save();
            return newCart;
        } catch (error) {
            console.log("Error al crear un carrito vacío");
            throw error;
        }
    }

    async getCartById(cartId) {
        try {
            const cart = await Cart.findById(cartId).populate('items.product').lean();
            return cart;
        } catch (error) {
            console.log("Error al obtener el carrito por ID");
            throw error;
        }
    }
    
    async addProductToCart(cartId, productId, quantity) {
        try {
            const cart = await Cart.findById(cartId);
            const product = await ProductEsquema.findById(productId);

            if (!cart) {
                console.log('Carrito no encontrado');
            }
            if (!product) {
                console.log('Producto no encontrado');
            }

            const existingItemIndex = cart.items.findIndex(item => item.product.equals(productId));

            if (existingItemIndex !== -1) {
                cart.items[existingItemIndex].quantity += quantity || 1;
            } else {
                cart.items.push({
                    product: productId,
                    quantity: quantity || 1,
                });
            }

            await cart.save();
            const updatedCart = await Cart.findById(cartId);
            return updatedCart;
        } catch (error) {
            console.log("Error al añadir producto al carrito");
            throw error;
        }
    }

    async deleteProductFromCart(cartId, productId) {
        try {
            const cart = await Cart.findById(cartId);

            if (!cart) {
                console.log('Carrito no encontrado');
            }
            const existingItemIndex = cart.items.findIndex(item => item.product.equals(productId));

            if (existingItemIndex !== -1) {
                // Elimina el producto del array de items
                cart.items.splice(existingItemIndex, 1);
            } else {
                console.log('Producto no encontrado en el carrito.');
            }

            // Llama a save para aplicar los cambios en la base de datos
            await cart.save();
            const updatedCart = await Cart.findById(cartId);
            return updatedCart;
        } catch (error) {
            console.log("Error al eliminar producto del carrito");
            throw error;
        }
    }

    async deleteCart(cartId) {
        try {
            let eliminarCarrito = await Cart.deleteOne({_id: cartId})
            if(!eliminarCarrito){
                console.log('Carrito no encontrado');
            }
            return eliminarCarrito;
        } catch (error) {
            console.log("Error al eliminar el carrito");
            throw error;
        }
    }

}