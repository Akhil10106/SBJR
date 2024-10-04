// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAG3xjX_n_Bx0p8WOGYMqZz9wiL9yWSZSc",
    authDomain: "sbjr-agriculture-shop.firebaseapp.com",
    projectId: "sbjr-agriculture-shop",
    storageBucket: "sbjr-agriculture-shop.appspot.com",
    messagingSenderId: "364119868491",
    appId: "1:364119868491:web:bf66589b710e4f5d7f79ce",
    measurementId: "G-RSJHB63PX9"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

let currentUser = null;
let cart = [];

function toggleAuthForm() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const authToggle = document.getElementById('auth-toggle');

    if (loginForm.style.display !== 'none') {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        authToggle.innerHTML = 'Already have an account? <a href="#" onclick="toggleAuthForm()">Login here</a>';
    } else {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        authToggle.innerHTML = 'New user? <a href="#" onclick="toggleAuthForm()">Register here</a>';
    }
}

// Listen for auth state changes
auth.onAuthStateChanged(user => {
    console.log("Auth state changed", user);
    if (user) {
        console.log("User is signed in", user);
        currentUser = user;
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('home-container').style.display = 'block';
        checkAdminStatus(user.uid);
        showHome();
    } else {
        console.log("User is signed out");
        currentUser = null;
        document.getElementById('login-container').style.display = 'block';
        document.getElementById('home-container').style.display = 'none';
        document.querySelector('.admin-only').style.display = 'none';
    }
});

function checkAdminStatus(uid) {
    console.log("Checking admin status for", uid);
    db.collection('users').doc(uid).get().then(doc => {
        console.log("User document", doc.data());
        if (doc.exists && doc.data().isAdmin) {
            document.querySelector('.admin-only').style.display = 'inline-block';
        }
    }).catch(error => {
        console.error("Error checking admin status", error);
        showError('Error checking admin status: ' + error.message);
    });
}

function login() {
    console.log("Login function called");
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showError('Please enter both email and password.');
        return;
    }
    
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            console.log("Login successful", userCredential.user);
            showSuccess(`Welcome back, ${userCredential.user.email}!`);
            showHome();
        })
        .catch((error) => {
            console.error("Login error", error);
            switch (error.code) {
                case 'auth/user-not-found':
                    showError('No user found with this email. Please check your email or register.');
                    break;
                case 'auth/wrong-password':
                    showError('Incorrect password. Please try again.');
                    break;
                case 'auth/invalid-email':
                    showError('Invalid email format. Please enter a valid email.');
                    break;
                default:
                    showError('Login failed: ' + error.message);
            }
        });
}

function register() {
    console.log("Register function called");
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    
    if (!name || !email || !password) {
        showError('Please fill in all fields.');
        return;
    }
    
    if (password.length < 6) {
        showError('Password must be at least 6 characters long.');
        return;
    }
    
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            console.log("User registered", userCredential.user);
            return db.collection('users').doc(userCredential.user.uid).set({
                name: name,
                email: email,
                isAdmin: false
            });
        })
        .then(() => {
            console.log("User data saved to Firestore");
            showSuccess('Registration successful. You are now logged in.');
            showHome();
        })
        .catch((error) => {
            console.error("Registration error", error);
            showError('Registration failed: ' + error.message);
        });
}

function logout() {
    console.log("Logout function called");
    auth.signOut().then(() => {
        console.log("User signed out");
        cart = [];
        showSuccess('You have been logged out successfully.');
    }).catch((error) => {
        console.error("Logout error", error);
        showError('Logout failed: ' + error.message);
    });
}

function showHome() {
    console.log("Showing home page");
    if (!currentUser) {
        console.error("No user logged in");
        showError('Please log in to view the home page.');
        return;
    }
    db.collection('users').doc(currentUser.uid).get().then(doc => {
        console.log("User data", doc.data());
        const content = `
            <h2>Welcome to SBJR Agriculture Shop, ${doc.data().name}!</h2>
            <p>Explore our products in the Shop.</p>
        `;
        document.getElementById('content').innerHTML = content;
    }).catch(error => {
        console.error("Error fetching user data", error);
        showError('Error loading home page: ' + error.message);
    });
}

function showShop() {
    console.log("Showing shop page");
    let content = `
        <h2>Shop</h2>
        <div id="search-bar" class="glass-panel">
            <input type="text" id="search-input" placeholder="Search products...">
            <button onclick="searchProducts()" class="glow-button">Search</button>
        </div>
        <div id="product-list" class="product-grid">
        </div>
    `;
    document.getElementById('content').innerHTML = content;
    loadProducts();
}

function loadProducts() {
    console.log("Loading products");
    db.collection('products').get().then((querySnapshot) => {
        let productsHtml = '';
        querySnapshot.forEach((doc) => {
            const product = doc.data();
            productsHtml += createProductCard(doc.id, product);
        });
        document.getElementById('product-list').innerHTML = productsHtml;
    }).catch(error => {
        console.error("Error loading products", error);
        showError('Error loading products: ' + error.message);
    });
}

function createProductCard(id, product) {
    return `
        <div class="product-card">
            <img src="${product.image}" alt="${product.name}" class="product-image">
            <div class="product-title">${product.name}</div>
            <div class="product-price">$${product.price}</div>
            <button onclick="addToCart('${id}')" class="add-to-cart">Add to Cart</button>
        </div>
    `;
}

function searchProducts() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
    if (!searchTerm) {
        loadProducts();
        return;
    }
    
    db.collection('products')
        .where('searchTerms', 'array-contains', searchTerm)
        .get()
        .then((querySnapshot) => {
            let productsHtml = '';
            querySnapshot.forEach((doc) => {
                const product = doc.data();
                productsHtml += createProductCard(doc.id, product);
            });
            document.getElementById('product-list').innerHTML = productsHtml || '<p>No products found.</p>';
        })
        .catch((error) => {
            console.error("Error searching products", error);
            showError('Error searching products: ' + error.message);
        });
}

function addToCart(productId) {
    console.log("Adding to cart", productId);
    if (!currentUser) {
        showError('Please log in to add items to your cart.');
        return;
    }
    
    db.collection('products').doc(productId).get().then((doc) => {
        if (doc.exists) {
            const product = doc.data();
            cart.push({id: doc.id, ...product});
            updateCartCount();
            showSuccess('Product added to cart');
        } else {
            showError('Product not found. Please try again.');
        }
    }).catch(error => {
        console.error("Error adding to cart", error);
        showError('Error adding product to cart: ' + error.message);
    });
}

function updateCartCount() {
    document.getElementById('cart-count').textContent = cart.length;
}

function showCart() {
    console.log("Showing cart");
    let content = '<h2>Shopping Cart</h2>';
    if (cart.length === 0) {
        content += '<p>Your cart is empty</p>';
    } else {
        let total = 0;
        content += '<ul>';
        cart.forEach(product => {
            content += `<li>${product.name} - $${product.price}</li>`;
            total += Number(product.price);
        });
        content += '</ul>';
        content += `<p>Total: $${total.toFixed(2)}</p>`;
        content += '<button onclick="checkout()" class="glow-button">Checkout</button>';
    }
    document.getElementById('content').innerHTML = content;
}

function checkout() {
    console.log("Checkout");
    if (cart.length === 0) {
        showError('Your cart is empty. Add some products before checking out.');
        return;
    }
    
    // Here you would typically process the order, save it to the database, etc.
    // For this example, we'll just clear the cart
    cart = [];
    updateCartCount();
    showSuccess('Order placed successfully! Thank you for your purchase.');
    showHome();
}

function showProfile() {
    console.log("Showing profile");
    if (!currentUser) {
        console.error("No user logged in");
        showError('Please log in to view your profile.');
        return;
    }
    db.collection('users').doc(currentUser.uid).get().then(doc => {
        const userData = doc.data();
        const content = `
            <h2>User Profile</h2>
            <p>Name: ${userData.name}</p>
            <p>Email: ${userData.email}</p>
            <p>Account Type: ${userData.isAdmin ? 'Administrator' : 'Customer'}</p>
        `;
        document.getElementById('content').innerHTML = content;
    }).catch(error => {
        console.error("Error fetching user profile", error);
        showError('Error loading profile: ' + error.message);
    });
}

function showAdminPanel() {
    console.log("Showing admin panel");
    if (!currentUser) {
        console.error("No user logged in");
        showError('Please log in to access the admin panel.');
        return;
    }
    db.collection('users').doc(currentUser.uid).get().then(doc => {
        if (doc.exists && doc.data().isAdmin) {
            const content = `
                <h2>Admin Panel</h2>
                <h3>Add New Product</h3>
                <form id="add-product-form">
                    <input type="text" id="product-name" placeholder="Product Name" required>
                    <textarea id="product-description" placeholder="Product Description" required></textarea>
                    <input type="number" id="product-price" placeholder="Product Price" step="0.01" required>
                    <input type="file" id="product-image" accept="image/*" required>
                    <button type="submit" class="glow-button">Add Product</button>
                </form>
                <div id="product-list">
                    <h3>Current Products</h3>
                    <ul id="admin-product-list"></ul>
                </div>
            `;
            document.getElementById('content').innerHTML = content;

            document.getElementById('add-product-form').addEventListener('submit', function(e) {
                e.preventDefault();
                addProduct();
            });

            updateAdminProductList();
        } else {
            showError('Access denied. Admin privileges required.');
        }
    }).catch(error => {
        console.error("Error showing admin panel", error);
        showError('Error accessing admin panel: ' + error.message);
    });
}

function addProduct() {
    console.log("Adding product");
    const name = document.getElementById('product-name').value.trim();
    const description = document.getElementById('product-description').value.trim();
    const price = document.getElementById('product-price').value;
    const imageFile = document.getElementById('product-image').files[0];
    
    if (!name || !description || !price || !imageFile) {
        showError('Please fill in all fields and select an image.');
        return;
    }
    
    if (isNaN(price) || price <= 0) {
        showError('Please enter a valid price.');
        return;
    }
    
    const storageRef = storage.ref('product-images/' + Date.now() + '_' + imageFile.name);
    storageRef.put(imageFile).then(() => {
        return storageRef.getDownloadURL();
    }).then((url) => {
        return db.collection('products').add({
            name: name,
            description: description,
            price: parseFloat(price).toFixed(2),
            image: url,
            searchTerms: name.toLowerCase().split(' ').concat(description.toLowerCase().split(' '))
        });
    }).then(() => {
        showSuccess('Product added successfully');
        document.getElementById('add-product-form').reset();
        updateAdminProductList();
    }).catch((error) => {
        console.error("Error adding product", error);
        showError('Error adding product: ' + error.message);
    });
}

function updateAdminProductList() {
    console.log("Updating admin product list");
    const list = document.getElementById('admin-product-list');
    list.innerHTML = '';
    db.collection('products').get().then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
            const product = doc.data();
            const li = document.createElement('li');
            li.innerHTML = `
                <img src="${product.image}" alt="${product.name}" style="width: 50px; height: 50px; object-fit: cover;">
                ${product.name} - $${product.price}
                <button onclick="deleteProduct('${doc.id}')">Delete</button>
            `;
            list.appendChild(li);
        });
    }).catch(error => {
        console.error("Error updating admin product list", error);
        showError('Error updating product list: ' + error.message);
    });
}

function deleteProduct(productId) {
    console.log("Deleting product", productId);
    db.collection('products').doc(productId).delete().then(() => {
        showSuccess('Product deleted successfully');
        updateAdminProductList();
    }).catch((error) => {
        console.error("Error deleting product", error);
        showError('Error deleting product: ' + error.message);
    });
}

function showError(message) {
    console.error("Error:", message);
    const messageContainer = document.getElementById('message-container');
    const errorElement = document.createElement('div');
    errorElement.className = 'error message';
    errorElement.textContent = message;
    messageContainer.appendChild(errorElement);
    setTimeout(() => errorElement.remove(), 5000);
}

function showSuccess(message) {
    console.log("Success:", message);
    const messageContainer = document.getElementById('message-container');
    const successElement = document.createElement('div');
    successElement.className = 'success message';
    successElement.textContent = message;
    messageContainer.appendChild(successElement);
    setTimeout(() => successElement.remove(), 5000);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM content loaded");
    updateCartCount();
});