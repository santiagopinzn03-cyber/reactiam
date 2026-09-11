import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, Alert, KeyboardAvoidingView, Platform } from 'react-native';

// Si pruebas en web o emulador Android usa 127.0.0.1. Si usas tu celular físico con Expo Go, pon la IP local de tu PC (ej: 192.168.1.X)
const API_URL = 'http://127.0.0.1:8000';

export default function UsuariosScreen() {
  const [usuarios, setUsuarios] = useState([]);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [editandoId, setEditandoId] = useState<number | null>(null);

  const obtenerUsuarios = async () => {
    try {
      const response = await fetch(`${API_URL}/usuarios/`);
      const data = await response.json();
      setUsuarios(data);
    } catch (error) {
      console.error("Error al cargar usuarios:", error);
      Alert.alert('Error', 'No se pudo conectar con el servidor.');
    }
  };

  useEffect(() => {
    obtenerUsuarios();
  }, []);

  const guardarUsuario = async () => {
    if (!nombre.trim() || !email.trim()) {
      Alert.alert('Atención', 'Por favor completa todos los campos');
      return;
    }

    try {
      if (editandoId) {
        await fetch(`${API_URL}/usuarios/${editandoId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, email }),
        });
        setEditandoId(null);
      } else {
        await fetch(`${API_URL}/usuarios/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, email }),
        });
      }
      setNombre('');
      setEmail('');
      obtenerUsuarios();
    } catch (error) {
      console.error("Error al guardar usuario:", error);
    }
  };

  const iniciarEdicion = (item: any) => {
    setEditandoId(item.id);
    setNombre(item.nombre);
    setEmail(item.email);
  };

  const eliminarUsuario = async (id: number) => {
    try {
      await fetch(`${API_URL}/usuarios/${id}`, {
        method: 'DELETE',
      });
      obtenerUsuarios();
    } catch (error) {
      console.error("Error al eliminar usuario:", error);
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

        <TouchableOpacity style={styles.botonGuardar} onPress={guardarUsuario}>
          <Text style={styles.textoBoton}>
            {editandoId ? 'Actualizar Usuario' : 'Crear Usuario'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={usuarios}
        keyExtractor={(item: any) => item.id.toString()}
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
              <TouchableOpacity onPress={() => eliminarUsuario(item.id)} style={styles.btnEliminar}>
                <Text style={styles.textoAccion}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f9f9f9', paddingTop: 50 },
  titulo: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#222' },
  formContainer: { marginBottom: 20 },
  input: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#ccc', color: '#000' },
  botonGuardar: { backgroundColor: '#007AFF', padding: 14, borderRadius: 8, alignItems: 'center' },
  textoBoton: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  nombre: { fontSize: 16, fontWeight: 'bold', color: '#222' },
  email: { fontSize: 14, color: '#666', marginTop: 2 },
  acciones: { flexDirection: 'row' },
  btnEditar: { backgroundColor: '#ffc107', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, marginRight: 8 },
  btnEliminar: { backgroundColor: '#dc3545', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  textoAccion: { color: '#fff', fontSize: 12, fontWeight: 'bold' }
});