const SUPABASE_URL = "https://wjaoodqyyakpsbtscurg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0-xD0UsupWcAHXHc6lz4aQ_Kd_nZXlz";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let usuarioActual = null;
let archivoFoto = null;
let propiedades = [];

const extensiones = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
};

function escapar(texto) {
    return String(texto ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));
}

function mostrarMensaje(texto, tipo) {
    const el = document.getElementById("mensajeFormulario");
    el.textContent = texto;
    el.className = tipo || "";
}

function switchTab(tabId) {
    document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".nav-tabs button").forEach(btn => btn.classList.remove("active"));

    document.getElementById(tabId).classList.add("active");
    const boton = document.querySelector(`.nav-tabs button[data-tab="${tabId}"]`);
    if (boton) boton.classList.add("active");

    if (tabId === "catalogoTab") {
        cargarPropiedades();
    }
}

function mostrarVistaPrevia(event) {
    const file = event.target.files[0];
    const vistaPrevia = document.getElementById("vistaPrevia");

    if (!file) {
        archivoFoto = null;
        vistaPrevia.style.display = "none";
        return;
    }

    if (!extensiones[file.type]) {
        mostrarMensaje("Solo se permiten imágenes JPG, PNG o WEBP.", "error");
        event.target.value = "";
        archivoFoto = null;
        vistaPrevia.style.display = "none";
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        mostrarMensaje("La imagen no puede pesar más de 5 MB.", "error");
        event.target.value = "";
        archivoFoto = null;
        vistaPrevia.style.display = "none";
        return;
    }

    mostrarMensaje("", "");
    archivoFoto = file;
    vistaPrevia.src = URL.createObjectURL(file);
    vistaPrevia.style.display = "block";
}

function registrarUsuario(e) {
    e.preventDefault();
    const nombre = document.getElementById("regNombre").value.trim();
    const rfc = document.getElementById("regRFC").value.trim().toUpperCase();
    const tel = document.getElementById("regTel").value.replace(/\D/g, "");
    const tipo = document.getElementById("regTipo").value;

    usuarioActual = { nombre, rfc, tel, tipo };

    document.getElementById("userInfoNav").innerText = `Usuario: ${nombre} (${tipo}) | RFC: ${rfc}`;
    alert(`¡Registro exitoso! Bienvenido ${nombre}. Ahora puedes publicar o buscar propiedades de forma segura.`);
    switchTab("catalogoTab");
}

async function subirFoto() {
    if (!archivoFoto) return null;

    const ruta = `${crypto.randomUUID()}.${extensiones[archivoFoto.type]}`;
    const { error } = await db.storage.from("fotos").upload(ruta, archivoFoto, {
        contentType: archivoFoto.type,
        upsert: false
    });

    if (error) throw error;

    const { data } = db.storage.from("fotos").getPublicUrl(ruta);
    return data.publicUrl;
}

async function publicarInmueble(e) {
    e.preventDefault();

    if (!usuarioActual) {
        alert("Debes registrarte primero en la pestaña 'Registro / Login' antes de publicar.");
        switchTab("registroTab");
        return;
    }

    const boton = document.getElementById("btnPublicar");
    boton.disabled = true;
    mostrarMensaje("Enviando publicación...", "");

    try {
        const imagenUrl = await subirFoto();

        const nuevaPropiedad = {
            titulo: document.getElementById("pubTitulo").value.trim(),
            tipo: document.getElementById("pubTipo").value,
            estado: document.getElementById("pubEstado").value,
            ubicacion: document.getElementById("pubUbicacion").value.trim(),
            precio: parseFloat(document.getElementById("pubPrecio").value),
            superficie: parseFloat(document.getElementById("pubSuperficie").value),
            documento: document.getElementById("pubDocumento").value,
            descripcion: document.getElementById("pubDesc").value.trim(),
            imagen_url: imagenUrl,
            vendedor_nombre: usuarioActual.nombre,
            vendedor_rfc: usuarioActual.rfc,
            vendedor_tel: usuarioActual.tel,
            vendedor_tipo: usuarioActual.tipo,
            status: "pendiente"
        };

        const { error } = await db.from("propiedades").insert(nuevaPropiedad);
        if (error) throw error;

        document.getElementById("formPublicar").reset();
        document.getElementById("vistaPrevia").style.display = "none";
        archivoFoto = null;

        mostrarMensaje("Publicación enviada. Aparecerá en el catálogo cuando sea revisada y aprobada.", "ok");
    } catch (err) {
        console.error(err);
        mostrarMensaje("No se pudo enviar la publicación. Revisa los datos e inténtalo de nuevo.", "error");
    } finally {
        boton.disabled = false;
    }
}

async function cargarPropiedades() {
    const contenedor = document.getElementById("listaPropiedades");
    contenedor.innerHTML = "Cargando propiedades...";

    const { data, error } = await db
        .from("propiedades_publicas")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error(error);
        contenedor.innerHTML = "<p>No se pudieron cargar las propiedades. Inténtalo más tarde.</p>";
        return;
    }

    propiedades = data;
    aplicarFiltros();
}

function aplicarFiltros() {
    const estadoSeleccionado = document.getElementById("filtroEstado").value;
    const precioMaximo = parseFloat(document.getElementById("filtroPrecio").value);

    const filtradas = propiedades.filter(prop => {
        const coincideEstado = (estadoSeleccionado === "TODOS" || prop.estado === estadoSeleccionado);
        const coincidePrecio = (isNaN(precioMaximo) || prop.precio <= precioMaximo);
        return coincideEstado && coincidePrecio;
    });

    renderizarPropiedades(filtradas);
}

function renderizarPropiedades(lista) {
    const contenedor = document.getElementById("listaPropiedades");
    contenedor.innerHTML = "";

    if (lista.length === 0) {
        contenedor.innerHTML = "<p>No se encontraron propiedades con los filtros seleccionados.</p>";
        return;
    }

    const formatoMXN = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

    lista.forEach(prop => {
        const isEjido = prop.tipo === "Terreno Ejidal";
        const badgeTipo = isEjido
            ? `<span class="badge-ejido">Ejidal (RAN)</span>`
            : `<span class="badge-verified">Urbano (RPP)</span>`;

        const imagen = prop.imagen_url && prop.imagen_url.startsWith("https://")
            ? `<img src="${escapar(prop.imagen_url)}" alt="${escapar(prop.titulo)}" class="property-img">`
            : `<div class="sin-foto">Sin fotografía</div>`;

        const telefono = String(prop.vendedor_tel).replace(/\D/g, "");

        contenedor.innerHTML += `
            <div class="property-card">
                <div class="property-img-container">${imagen}</div>
                <div class="property-header">
                    <small><b>${escapar(prop.estado)}</b></small>
                    ${badgeTipo}
                </div>
                <div class="property-body">
                    <h3>${escapar(prop.titulo)}</h3>
                    <div class="property-price">${formatoMXN.format(prop.precio)}</div>
                    <p><strong>Tipo:</strong> ${escapar(prop.tipo)}</p>
                    <p><strong>Ubicación:</strong> ${escapar(prop.ubicacion)}</p>
                    <p><strong>Superficie:</strong> ${escapar(prop.superficie)} m²</p>
                    <p><strong>Respaldo:</strong> ${escapar(prop.documento)}</p>
                    <p><small>${escapar(prop.descripcion)}</small></p>

                    <div class="contact-box">
                        <strong>Vendedor:</strong> ${escapar(prop.vendedor_nombre)}<br>
                        <strong>Contacto / Tel:</strong> <a href="https://wa.me/52${telefono}" target="_blank" rel="noopener noreferrer">${telefono}</a>
                    </div>
                </div>
            </div>
        `;
    });
}

cargarPropiedades();
