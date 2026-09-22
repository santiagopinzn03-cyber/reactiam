import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// Si pruebas en web o emulador Android usa 127.0.0.1. Si usas tu celular físico con Expo Go, pon la IP local de tu PC (ej: 192.168.1.X)
const API_URL = 'http://127.0.0.1:8000';

type Usuario = { id: number; nombre: string; email: string };

/**
 * fetch NO lanza error en respuestas 4xx/5xx: sin esto, un fallo del backend
 * (email duplicado, servidor caído con 5xx, etc.) se tragaba en silencio.
 * Aquí convertimos cualquier respuesta no exitosa en una excepción con el detalle.
 */
async function pedir(url: string, init?: RequestInit): Promise<Response> {
  const respuesta = await fetch(url, init);
  if (!respuesta.ok) {
    let detalle = `el servidor respondió HTTP ${respuesta.status}`;
    try {
      const cuerpo = await respuesta.json();
      if (cuerpo && typeof cuerpo.detail === 'string') detalle = cuerpo.detail;
    } catch {
      // Sin cuerpo JSON: nos quedamos con el código HTTP.
    }
    throw new Error(detalle);
  }
  return respuesta;
}

const mensajeDeError = (error: unknown, porDefecto: string) =>
  error instanceof Error ? error.message : porDefecto;

export default function UsuariosScreen() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const obtenerUsuarios = async () => {
    try {
      const respuesta = await pedir(`${API_URL}/usuarios/`);
      setUsuarios((await respuesta.json()) as Usuario[]);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      Alert.alert('Error', 'No se pudo conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    // Carga inicial: se ejecuta una sola vez al montar la pantalla.
    (async () => {
      await obtenerUsuarios();
    })();
  }, []);

  const guardarUsuario = async () => {
    if (!nombre.trim() || !email.trim()) {
      Alert.alert('Atención', 'Por favor completa todos los campos');
      return;
    }

    setGuardando(true);
    try {
      const opciones: RequestInit = {
        method: editandoId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), email: email.trim() }),
      };
      await pedir(
        editandoId ? `${API_URL}/usuarios/${editandoId}` : `${API_URL}/usuarios/`,
        opciones,
      );
      setEditandoId(null);
      setNombre('');
      setEmail('');
      await obtenerUsuarios();
    } catch (error) {
      console.error('Error al guardar usuario:', error);
      Alert.alert('No se pudo guardar', mensajeDeError(error, 'Error desconocido.'));
    } finally {
      setGuardando(false);
    }
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setNombre('');
    setEmail('');
  };

  const iniciarEdicion = (item: Usuario) => {
    setEditandoId(item.id);
    setNombre(item.nombre);
    setEmail(item.email);
  };

  const eliminarUsuario = async (id: number) => {
    try {
      await pedir(`${API_URL}/usuarios/${id}`, { method: 'DELETE' });
      if (editandoId === id) cancelarEdicion();
      await obtenerUsuarios();
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      Alert.alert('No se pudo eliminar', mensajeDeError(error, 'Error desconocido.'));
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Text style={styles.titulo}>Gestión de Usuarios - Titán V</Text>

      <View style={styles.formContainer}>
        <TextInput
          style={styles.input}
          placeholder="Nombre del usuario"
          placeholderTextColor="#888"
          value={nombre}
          onChangeText={setNombre}
        />
        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TouchableOpacity
          style={[styles.botonGuardar, guardando && styles.botonDeshabilitado]}
          onPress={guardarUsuario}
          disabled={guardando}
        >
          <Text style={styles.textoBoton}>
            {guardando
              ? 'Guardando…'
              : editandoId
                ? 'Actualizar Usuario'
                : 'Crear Usuario'}
          </Text>
        </TouchableOpacity>

        {editandoId ? (
          <TouchableOpacity style={styles.botonCancelar} onPress={cancelarEdicion}>
            <Text style={styles.textoCancelar}>Cancelar edición</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {cargando ? (
        <ActivityIndicator size="large" color="#007AFF" style={styles.cargando} />
      ) : (
        <FlatList
          data={usuarios}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            <Text style={styles.listaVacia}>
              Todavía no hay usuarios. Creá el primero con el formulario de arriba.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nombre}>{item.nombre}</Text>
                <Text style={styles.email}>{item.email}</Text>
              </View>
              <View style={styles.acciones}>
                <TouchableOpacity onPress={() => iniciarEdicion(item)} style={styles.btnEditar}>
                  <Text style={styles.textoAccion}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => eliminarUsuario(item.id)}
                  style={styles.btnEliminar}
                >
                  <Text style={styles.textoAccion}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f9f9f9', paddingTop: 50 },
  titulo: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#222' },
  formContainer: { marginBottom: 20 },
  input: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#ccc', color: '#000' },
  botonGuardar: { backgroundColor: '#007AFF', padding: 14, borderRadius: 8, alignItems: 'center' },
  botonDeshabilitado: { opacity: 0.6 },
  botonCancelar: { padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: '#ced4da', backgroundColor: '#fff' },
  textoCancelar: { color: '#495057', fontWeight: '600', fontSize: 14 },
  textoBoton: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cargando: { marginTop: 30 },
  listaVacia: { textAlign: 'center', color: '#868e96', fontSize: 14, marginTop: 30, lineHeight: 20 },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  nombre: { fontSize: 16, fontWeight: 'bold', color: '#222' },
  email: { fontSize: 14, color: '#666', marginTop: 2 },
  acciones: { flexDirection: 'row' },
  btnEditar: { backgroundColor: '#ffc107', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, marginRight: 8 },
  btnEliminar: { backgroundColor: '#dc3545', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  textoAccion: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
});
