import streamlit as st
import pandas as pd

st.set_page_config(layout="wide")

st.title("Gestión de Órdenes")

archivo = st.file_uploader("Subir archivo", type=["csv", "xlsx"])

if archivo:

    # -------------------------
    # CARGA
    # -------------------------
    if archivo.name.endswith(".csv"):
        df = pd.read_csv(archivo, sep=";", encoding="latin1")
    else:
        df = pd.read_excel(archivo)

    df.columns = df.columns.str.strip()

    # -------------------------
    # FLAGS
    # -------------------------
    df["tiene_devolucion"] = df["Devolucion"].astype(str).str.upper() == "VERDADERO"
    df["tiene_foja"] = df["Foja"].notna()
    df["tiene_ci"] = df["CI"].astype(str).str.upper() == "VERDADERO"

    # -------------------------
    # CABECERA
    # -------------------------
    cabecera = (
        df.groupby("Orden")
        .agg({
            "Apellido": "first",
            "Nombre": "first",
            "Dni": "first",
            "ObraSocial": "first",
            "FechaCX": "first",
            "Vendedor": "first",
            "Medico": "first",
            "MedicoSolicitante": "first",
            "Foja": "first",
            "CI": "first",
            "Actividades": "first",
            "Institucion": "first",
            "Ciudad": "first",
            "Expediente": "first",
            "Favotito": "first",
            "Devolucion": "first",
            "Prioridad": "first",
            "tiene_devolucion": "max",
            "tiene_foja": "max",
            "tiene_ci": "max"
        })
        .reset_index()
    )

    cabecera["Paciente"] = cabecera["Apellido"] + " " + cabecera["Nombre"]

    # -------------------------
    # SIDEBAR FILTROS
    # -------------------------
    st.sidebar.header("Filtros")

    inst = st.sidebar.selectbox(
        "Institución",
        ["Todas"] + sorted(cabecera["Institucion"].dropna().unique())
    )

    devol = st.sidebar.selectbox("Devolución Pendiente", ["Todas", "Sí", "No"])
    foja = st.sidebar.selectbox("Foja", ["Todas", "Sí", "No"])
    ci = st.sidebar.selectbox("Certificado (CI)", ["Todas", "Sí", "No"])

    prioridad = st.sidebar.selectbox(
        "Prioridad",
        ["Todas"] + sorted(cabecera["Prioridad"].dropna().unique())
    )

    obra = st.sidebar.selectbox(
        "Obra Social",
        ["Todas"] + sorted(cabecera["ObraSocial"].dropna().unique())
    )

    ciudad = st.sidebar.selectbox(
        "Ciudad",
        ["Todas"] + sorted(cabecera["Ciudad"].dropna().unique())
    )

    # -------------------------
    # FILTRADO
    # -------------------------
    filtrado = cabecera.copy()

    if inst != "Todas":
        filtrado = filtrado[filtrado["Institucion"] == inst]

    if devol == "Sí":
        filtrado = filtrado[filtrado["tiene_devolucion"]]
    elif devol == "No":
        filtrado = filtrado[~filtrado["tiene_devolucion"]]

    if foja == "Sí":
        filtrado = filtrado[filtrado["tiene_foja"]]
    elif foja == "No":
        filtrado = filtrado[~filtrado["tiene_foja"]]

    if ci == "Sí":
        filtrado = filtrado[filtrado["tiene_ci"]]
    elif ci == "No":
        filtrado = filtrado[~filtrado["tiene_ci"]]

    if prioridad != "Todas":
        filtrado = filtrado[filtrado["Prioridad"] == prioridad]

    if obra != "Todas":
        filtrado = filtrado[filtrado["ObraSocial"] == obra]

    if ciudad != "Todas":
        filtrado = filtrado[filtrado["Ciudad"] == ciudad]

    # -------------------------
    # LISTA DE ÓRDENES (SOLO CAMPOS CLAVE)
    # -------------------------
    st.subheader("Órdenes")

    tabla = filtrado[[
        "Orden",
        "Paciente",
        "Dni",
        "ObraSocial",
        "Favotito",
        "Prioridad"
    ]]

    st.dataframe(tabla, use_container_width=True, height=300)

    # Selección
    orden = st.selectbox("Seleccionar Orden", filtrado["Orden"])

    cab = cabecera[cabecera["Orden"] == orden]
    det = df[df["Orden"] == orden]

    st.divider()

    # -------------------------
    # CABECERA COMPLETA (ARRIBA)
    # -------------------------
    st.subheader("Cabecera de la Orden")

    st.write(f"**Orden:** {orden}")
    st.write(f"**Paciente:** {cab['Paciente'].values[0]}")
    st.write(f"**DNI:** {cab['Dni'].values[0]}")
    st.write(f"**Obra Social:** {cab['ObraSocial'].values[0]}")
    st.write(f"**Fecha CX:** {cab['FechaCX'].values[0]}")
    st.write(f"**Institución:** {cab['Institucion'].values[0]}")
    st.write(f"**Ciudad:** {cab['Ciudad'].values[0]}")
    st.write(f"**Vendedor:** {cab['Vendedor'].values[0]}")
    st.write(f"**Médico:** {cab['Medico'].values[0]}")
    st.write(f"**Médico Solicitante:** {cab['MedicoSolicitante'].values[0]}")
    st.write(f"**Expediente:** {cab['Expediente'].values[0]}")
    st.write(f"**Actividades:** {cab['Actividades'].values[0]}")

    st.write(f"**Prioridad:** {cab['Prioridad'].values[0]}")
    st.write(f"**Favorito:** {cab['Favotito'].values[0]}")

    st.write(f"**Devolución:** {'Sí' if cab['tiene_devolucion'].values[0] else 'No'}")
    st.write(f"**Foja:** {'Sí' if cab['tiene_foja'].values[0] else 'No'}")
    st.write(f"**CI:** {'Sí' if cab['tiene_ci'].values[0] else 'No'}")

    # -------------------------
    # DETALLE (ABAJO)
    # -------------------------
    st.subheader("Detalle de Productos")

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

    st.dataframe(det[columnas_validas], use_container_width=True, height=300)
