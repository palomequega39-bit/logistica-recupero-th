import streamlit as st
import pandas as pd

st.set_page_config(layout="wide")

st.title("Logística Recupero TH")

archivo = st.file_uploader("Subir archivo Excel o CSV", type=["csv", "xlsx"])

if archivo:

    # Cargar archivo
    if archivo.name.endswith(".csv"):
        df = pd.read_csv(archivo, sep=";", encoding="latin1")
    else:
        df = pd.read_excel(archivo)

    # Limpiar nombres de columnas
    df.columns = df.columns.str.strip()

    # Flags
    df["tiene_devolucion"] = df["Devolucion"].astype(str).str.upper() == "VERDADERO"
    df["tiene_foja"] = df["Foja"].notna()
    df["tiene_ci"] = df["CI"].astype(str).str.upper() == "VERDADERO"

    # CABECERA (una fila por orden)
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

    st.subheader("Listado de Órdenes")
    st.dataframe(cabecera, use_container_width=True)

    # Selección de orden
    orden = st.selectbox("Seleccionar Orden", cabecera["Orden"])

    cab = cabecera[cabecera["Orden"] == orden]
    det = df[df["Orden"] == orden]

    st.divider()

    # CABECERA
    st.subheader("Cabecera de la Orden")
    st.dataframe(cab, use_container_width=True)

    # DETALLE
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

    st.dataframe(det[columnas_validas], use_container_width=True)
