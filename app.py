import streamlit as st
import pandas as pd

st.set_page_config(layout="wide")

st.title("Logística Recupero TH")

archivo = st.file_uploader("Subir archivo Excel o CSV", type=["csv", "xlsx"])

if archivo:

    if archivo.name.endswith(".csv"):
        df = pd.read_csv(archivo, sep=";", encoding="latin1")
    else:
        df = pd.read_excel(archivo)

    df.columns = df.columns.str.strip()

    df["tiene_devolucion"] = df["Devolucion"].astype(str).str.upper() == "VERDADERO"
    df["tiene_foja"] = df["Foja"].notna()
    df["tiene_ci"] = df["Ci"].astype(str).str.upper() == "VERDADERO"

    cabecera = (
        df.groupby("Orden")
        .agg({
            "Apellido": "first",
            "Nombre": "first",
            "Dni": "first",
            "Obra Social": "first",
            "Fecha de CX": "first",
            "Vendedor": "first",
            "Medico": "first",
            "Medico Solicitante": "first",
            "Foja": "first",
            "Ci": "first",
            "Actividades": "first",
            "Institucion": "first",
            "Ciudad": "first",
            "Expediente": "first",
            "Favorito": "first",
            "Devolucion": "first",
            "Prioridad": "first",
            "tiene_devolucion": "max",
            "tiene_foja": "max",
            "tiene_ci": "max"
        })
        .reset_index()
    )

    st.subheader("Órdenes")
    st.dataframe(cabecera, use_container_width=True)

    orden = st.selectbox("Seleccionar Orden", cabecera["Orden"])

    cab = cabecera[cabecera["Orden"] == orden]
    det = df[df["Orden"] == orden]

    st.subheader("Cabecera")
    st.dataframe(cab, use_container_width=True)

    st.subheader("Detalle")

    columnas = [
        "N° Remito",
        "Fecha Remito",
        "Producto",
        "Cantidad",
        "Lote",
        "Serie",
        "Vencimiento"
    ]

    columnas_validas = [c for c in columnas if c in det.columns]

    st.dataframe(det[columnas_validas], use_container_width=True)
