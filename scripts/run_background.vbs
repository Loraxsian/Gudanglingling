Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

If WScript.Arguments.Count > 0 Then
    appPath = WScript.Arguments(0)
    WshShell.Run "python """ & appPath & """", 0, False
End If
