import streamlit as st
import pandas as pd

st.set_page_config(layout="wide")

st.title("Gestión de Órdenes")

archivo = st.file_uploader("Subir archivo", type=["csv", "xlsx"])

if archivo:

    # Carga
    if archivo.name.endswith(".csv"):
        df = pd.read_csv(archivo, sep=";", encoding="latin1")
    else:
        df = pd.read_excel(archivo)

    df.columns = df.columns.str.strip()

    # Flags
    df["tiene_devolucion"] = df["Devolucion"].astype(str).str.upper() == "VERDADERO"
    df["tiene_foja"] = df["Foja"].notna()
    df["tiene_ci"] = df["CI"].astype(str).str.upper() == "VERDADERO"

    # CABECERA
    cabecera = (
        df.groupby("Orden")
        .agg({
            "Apellido": "first",
            "Nombre": "first",
            "Dni": "first",
            "ObraSocial": "first",
            "FechaCX": "first",
            "Institucion": "first",
            "Ciudad": "first",
            "Prioridad": "first",
            "tiene_devolucion": "max",
            "tiene_foja": "max",
            "tiene_ci": "max"
        })
        .reset_index()
    )

    # -----------------------------
    # SIDEBAR (FILTROS)
    # -----------------------------
    st.sidebar.header("Filtros")

    instituciones = ["Todas"] + sorted(cabecera["Institucion"].dropna().unique())
    inst_sel = st.sidebar.selectbox("Institución", instituciones)

    devolucion_sel = st.sidebar.selectbox("Devolución", ["Todas", "Sí", "No"])

    # Aplicar filtros
    filtrado = cabecera.copy()

    if inst_sel != "Todas":
        filtrado = filtrado[filtrado["Institucion"] == inst_sel]

    if devolucion_sel == "Sí":
        filtrado = filtrado[filtrado["tiene_devolucion"]]
    elif devolucion_sel == "No":
        filtrado = filtrado[~filtrado["tiene_devolucion"]]

    # -----------------------------
    # TABLA PRINCIPAL
    # -----------------------------
    st.subheader("Órdenes")

    tabla = st.dataframe(
        filtrado,
        use_container_width=True,
        height=300  # 🔥 clave para evitar scroll gigante
    )

    # Selección simple (temporal)
    orden = st.selectbox("Seleccionar Orden", filtrado["Orden"])

    # -----------------------------
    # DETALLE
    # -----------------------------
    cab = cabecera[cabecera["Orden"] == orden]
    det = df[df["Orden"] == orden]

    st.divider()

    col1, col2 = st.columns([2, 3])

    # CABECERA COMPACTA
    with col1:
        st.subheader("Cabecera")

        st.write(f"**Paciente:** {cab['Apellido'].values[0]} {cab['Nombre'].values[0]}")
        st.write(f"**DNI:** {cab['Dni'].values[0]}")
        st.write(f"**Obra Social:** {cab['ObraSocial'].values[0]}")
        st.write(f"**Institución:** {cab['Institucion'].values[0]}")
        st.write(f"**Ciudad:** {cab['Ciudad'].values[0]}")
        st.write(f"**Prioridad:** {cab['Prioridad'].values[0]}")

        st.write(f"**Devolución:** {'Sí' if cab['tiene_devolucion'].values[0] else 'No'}")
        st.write(f"**Foja:** {'Sí' if cab['tiene_foja'].values[0] else 'No'}")
        st.write(f"**CI:** {'Sí' if cab['tiene_ci'].values[0] else 'No'}")

    # DETALLE PRODUCTOS
    with col2:
        st.subheader("Detalle")

        columnas = [
            "Remito",
            "FechaR",
            "Producto",
            "Q",
            "Lote",
            "Serie",
            "Vencimiento"
        ]

        columnas_validas = [c for c in columnas if c in det.columns]

        st.dataframe(
            det[columnas_validas],
            use_container_width=True,
            height=300  # 🔥 clave
        )
